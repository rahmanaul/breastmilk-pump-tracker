import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const intervalValidator = v.object({
  type: v.union(v.literal("pump"), v.literal("rest")),
  startTime: v.number(),
  endTime: v.optional(v.number()),
});

const timerConfigValidator = v.object({
  pumpDuration: v.number(), // seconds
  restDuration: v.number(), // seconds
  cycles: v.number(), // number of pump-rest cycles
});

const sessionValidator = v.object({
  _id: v.id("pumpingSessions"),
  _creationTime: v.number(),
  userId: v.id("users"),
  sessionType: v.union(v.literal("regular"), v.literal("power")),
  startTime: v.number(),
  endTime: v.optional(v.number()),
  volume: v.optional(v.number()),
  intervals: v.array(intervalValidator),
  totalPumpDuration: v.optional(v.number()),
  totalRestDuration: v.optional(v.number()),
  notes: v.optional(v.string()),
  status: v.union(v.literal("in_progress"), v.literal("completed")),
  // NEW: Schedule-linked fields
  scheduleSlotId: v.optional(v.string()),
  scheduledTime: v.optional(v.number()),
  latenessMinutes: v.optional(v.number()),
  isCompleted: v.optional(v.boolean()),
  timerConfig: v.optional(timerConfigValidator),
});

// Start a new pumping session
export const start = mutation({
  args: {
    sessionType: v.union(v.literal("regular"), v.literal("power")),
    // NEW: Optional schedule-linked fields
    scheduleSlotId: v.optional(v.string()),
    scheduledTime: v.optional(v.number()), // timestamp ms of scheduled time
    timerConfig: v.optional(
      v.object({
        pumpDuration: v.number(),
        restDuration: v.number(),
        cycles: v.number(),
      })
    ),
  },
  returns: v.id("pumpingSessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check for existing in-progress session
    const existingSession = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (existingSession && existingSession.status === "in_progress") {
      throw new Error("Sudah ada sesi yang sedang berjalan. Selesaikan dulu sesi tersebut.");
    }

    const now = Date.now();

    // Calculate lateness if this is a scheduled session
    let latenessMinutes: number | undefined = undefined;
    if (args.scheduledTime) {
      const diffMs = now - args.scheduledTime;
      latenessMinutes = Math.max(0, Math.floor(diffMs / 60000));
    }

    return await ctx.db.insert("pumpingSessions", {
      userId,
      sessionType: args.sessionType,
      startTime: now,
      intervals: [
        {
          type: "pump",
          startTime: now,
        },
      ],
      status: "in_progress",
      // NEW fields
      scheduleSlotId: args.scheduleSlotId,
      scheduledTime: args.scheduledTime,
      latenessMinutes,
      timerConfig: args.timerConfig,
    });
  },
});

// Switch interval (pump <-> rest)
export const switchInterval = mutation({
  args: {
    sessionId: v.id("pumpingSessions"),
    newIntervalType: v.union(v.literal("pump"), v.literal("rest")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    if (session.status !== "in_progress") {
      throw new Error("Session is not in progress");
    }

    const now = Date.now();
    const intervals = [...session.intervals];

    // End the current interval
    if (intervals.length > 0) {
      const lastInterval = intervals[intervals.length - 1];
      if (!lastInterval.endTime) {
        intervals[intervals.length - 1] = {
          ...lastInterval,
          endTime: now,
        };
      }
    }

    // Start a new interval
    intervals.push({
      type: args.newIntervalType,
      startTime: now,
    });

    await ctx.db.patch(args.sessionId, { intervals });

    return null;
  },
});

// Complete a session
export const complete = mutation({
  args: {
    sessionId: v.id("pumpingSessions"),
    volume: v.number(),
    notes: v.optional(v.string()),
    isCompleted: v.optional(v.boolean()), // NEW: tuntas (true) or tidak tuntas (false)
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const now = Date.now();
    const intervals = [...session.intervals];

    // End the current interval if still open
    if (intervals.length > 0) {
      const lastInterval = intervals[intervals.length - 1];
      if (!lastInterval.endTime) {
        intervals[intervals.length - 1] = {
          ...lastInterval,
          endTime: now,
        };
      }
    }

    // Calculate total durations
    let totalPumpDuration = 0;
    let totalRestDuration = 0;

    for (const interval of intervals) {
      if (interval.endTime) {
        const duration = (interval.endTime - interval.startTime) / 1000; // seconds
        if (interval.type === "pump") {
          totalPumpDuration += duration;
        } else {
          totalRestDuration += duration;
        }
      }
    }

    await ctx.db.patch(args.sessionId, {
      endTime: now,
      volume: args.volume,
      notes: args.notes,
      intervals,
      totalPumpDuration,
      totalRestDuration,
      status: "completed",
      isCompleted: args.isCompleted ?? true, // Default to true if not specified
    });

    return null;
  },
});

// Get current in-progress session
export const getCurrent = query({
  args: {},
  returns: v.union(sessionValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (session && session.status === "in_progress") {
      return session;
    }

    return null;
  },
});

// Get today's sessions
export const getToday = query({
  args: {},
  returns: v.array(sessionValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get start of today (midnight)
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    const sessions = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", userId).gte("startTime", startOfDay)
      )
      .order("desc")
      .collect();

    return sessions.filter((s) => s.status === "completed");
  },
});

// Get sessions by date range
export const getByDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.array(sessionValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // If startDate is 0, get all sessions for user (no date filter)
    if (args.startDate === 0) {
      const sessions = await ctx.db
        .query("pumpingSessions")
        .withIndex("by_user_and_time", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();

      return sessions.filter((s) => s.status === "completed");
    }

    // Otherwise, filter by date range
    const sessions = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", userId).gte("startTime", args.startDate)
      )
      .order("desc")
      .collect();

    // Filter by endDate and status in memory
    return sessions.filter(
      (s) => s.status === "completed" && s.startTime <= args.endDate
    );
  },
});

// Get a single session by ID
export const getById = query({
  args: {
    sessionId: v.id("pumpingSessions"),
  },
  returns: v.union(sessionValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    return session;
  },
});

// Delete a session
export const remove = mutation({
  args: {
    sessionId: v.id("pumpingSessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    await ctx.db.delete(args.sessionId);

    return null;
  },
});

// Schedule status item validator for return type
const scheduleStatusValidator = v.object({
  scheduleSlotId: v.optional(v.string()), // optional for backward compatibility
  time: v.string(), // "HH:mm"
  scheduledTimestamp: v.number(), // timestamp ms for today
  sessionType: v.union(v.literal("regular"), v.literal("power")), // always required in output
  status: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("late"), // completed but was late
    v.literal("missed") // past time, not done
  ),
  session: v.optional(sessionValidator),
  latenessMinutes: v.optional(v.number()),
  isCompleted: v.optional(v.boolean()),
});

// Get today's schedule with session status
export const getTodayScheduleStatus = query({
  args: {
    // Optional client timezone info for accurate schedule matching
    clientStartOfDay: v.optional(v.number()), // Client's local midnight timestamp
    clientNow: v.optional(v.number()), // Client's current timestamp
  },
  returns: v.array(scheduleStatusValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get user preferences to get schedule
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!preferences?.sessionSchedule) {
      return [];
    }

    // Use client's timezone info if provided, otherwise fall back to server time (UTC)
    const now = args.clientNow ? new Date(args.clientNow) : new Date();
    const startOfDay = args.clientStartOfDay
      ? new Date(args.clientStartOfDay)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's sessions (including in_progress)
    const todaySessions = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", userId).gte("startTime", startOfDay.getTime())
      )
      .collect();

    // Build schedule status for each slot
    const result = [];

    for (const slot of preferences.sessionSchedule) {
      if (!slot.enabled) continue;

      // Parse time "HH:mm" to get timestamp for today
      const [hours, minutes] = slot.time.split(":").map(Number);
      const scheduledDate = new Date(startOfDay);
      scheduledDate.setHours(hours, minutes, 0, 0);
      const scheduledTimestamp = scheduledDate.getTime();

      // Find session linked to this slot (by scheduleSlotId or by close time match)
      const linkedSession = todaySessions.find(
        (s) =>
          s.scheduleSlotId === slot.id ||
          // Fallback: match by time proximity (within 60 minutes before/after scheduled time)
          (s.scheduledTime &&
            Math.abs(s.scheduledTime - scheduledTimestamp) < 60 * 60 * 1000)
      );

      let status: "pending" | "in_progress" | "completed" | "late" | "missed" =
        "pending";
      let latenessMinutes: number | undefined = undefined;
      let isCompleted: boolean | undefined = undefined;

      if (linkedSession) {
        if (linkedSession.status === "in_progress") {
          status = "in_progress";
        } else if (linkedSession.status === "completed") {
          latenessMinutes = linkedSession.latenessMinutes;
          isCompleted = linkedSession.isCompleted;
          // If late > 0, mark as "late", otherwise "completed"
          status =
            latenessMinutes !== undefined && latenessMinutes > 0
              ? "late"
              : "completed";
        }
      } else {
        // No linked session - check if time has passed
        if (now.getTime() > scheduledTimestamp + 30 * 60 * 1000) {
          // 30 min grace period
          status = "missed";
        } else {
          status = "pending";
        }
      }

      result.push({
        scheduleSlotId: slot.id,
        time: slot.time,
        scheduledTimestamp,
        sessionType: slot.sessionType ?? "regular", // Default to "regular" for backward compatibility
        status,
        session: linkedSession,
        latenessMinutes,
        isCompleted,
      });
    }

    // Sort by time
    result.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);

    return result;
  },
});
