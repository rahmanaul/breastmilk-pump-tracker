import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Adherence status type for tracking schedule compliance
const adherenceStatusValidator = v.union(
  v.literal("on_time"), // latenessMinutes === 0 or <= threshold
  v.literal("late"), // latenessMinutes > threshold
  v.literal("missed") // scheduled slot with no session
);

// Get daily stats for the last N days
export const getDailyStats = query({
  args: {
    days: v.number(),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      totalVolume: v.number(),
      sessionCount: v.number(),
      regularVolume: v.number(),
      powerVolume: v.number(),
      avgVolumePerSession: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - args.days);
    startDate.setHours(0, 0, 0, 0);

    // Query with date range, filter completed sessions in memory
    const sessions = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", userId).gte("startTime", startDate.getTime())
      )
      .collect();

    const completedSessions = sessions.filter((s) => s.status === "completed");

    // Group by date
    const dailyMap = new Map<
      string,
      {
        totalVolume: number;
        sessionCount: number;
        regularVolume: number;
        powerVolume: number;
      }
    >();

    // Initialize all days
    for (let i = 0; i < args.days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, {
        totalVolume: 0,
        sessionCount: 0,
        regularVolume: 0,
        powerVolume: 0,
      });
    }

    // Aggregate sessions
    for (const session of completedSessions) {
      const dateStr = new Date(session.startTime).toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.totalVolume += session.volume || 0;
        existing.sessionCount += 1;
        if (session.sessionType === "regular") {
          existing.regularVolume += session.volume || 0;
        } else {
          existing.powerVolume += session.volume || 0;
        }
      }
    }

    // Convert to array and sort by date
    const result = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        totalVolume: data.totalVolume,
        sessionCount: data.sessionCount,
        regularVolume: data.regularVolume,
        powerVolume: data.powerVolume,
        avgVolumePerSession:
          data.sessionCount > 0
            ? Math.round(data.totalVolume / data.sessionCount)
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  },
});

// Get overall stats summary
export const getSummary = query({
  args: {
    // Optional: limit to last N days (default: 365 for reasonable performance)
    days: v.optional(v.number()),
  },
  returns: v.object({
    totalSessions: v.number(),
    totalVolume: v.number(),
    avgVolumePerSession: v.number(),
    avgVolumePerDay: v.number(),
    bestSession: v.union(
      v.object({
        volume: v.number(),
        date: v.number(),
        sessionType: v.union(v.literal("regular"), v.literal("power")),
      }),
      v.null()
    ),
    bestDay: v.union(
      v.object({
        date: v.string(),
        volume: v.number(),
      }),
      v.null()
    ),
    regularStats: v.object({
      count: v.number(),
      totalVolume: v.number(),
      avgVolume: v.number(),
    }),
    powerStats: v.object({
      count: v.number(),
      totalVolume: v.number(),
      avgVolume: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalSessions: 0,
        totalVolume: 0,
        avgVolumePerSession: 0,
        avgVolumePerDay: 0,
        bestSession: null,
        bestDay: null,
        regularStats: { count: 0, totalVolume: 0, avgVolume: 0 },
        powerStats: { count: 0, totalVolume: 0, avgVolume: 0 },
      };
    }

    // Default to 365 days for "all time" stats (bounded for performance)
    const daysLimit = args.days ?? 365;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysLimit);
    startDate.setHours(0, 0, 0, 0);

    // Query with date range, filter completed sessions in memory
    const sessions = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", userId).gte("startTime", startDate.getTime())
      )
      .collect();

    const completedSessions = sessions.filter((s) => s.status === "completed");

    if (completedSessions.length === 0) {
      return {
        totalSessions: 0,
        totalVolume: 0,
        avgVolumePerSession: 0,
        avgVolumePerDay: 0,
        bestSession: null,
        bestDay: null,
        regularStats: { count: 0, totalVolume: 0, avgVolume: 0 },
        powerStats: { count: 0, totalVolume: 0, avgVolume: 0 },
      };
    }

    const totalVolume = completedSessions.reduce(
      (sum, s) => sum + (s.volume || 0),
      0
    );

    // Best session
    const bestSession = completedSessions.reduce(
      (best, s) => ((s.volume || 0) > (best.volume || 0) ? s : best),
      completedSessions[0]
    );

    // Group by day for best day and avg per day
    const dailyVolumes = new Map<string, number>();
    for (const session of completedSessions) {
      const dateStr = new Date(session.startTime).toISOString().split("T")[0];
      dailyVolumes.set(
        dateStr,
        (dailyVolumes.get(dateStr) || 0) + (session.volume || 0)
      );
    }

    let bestDay: { date: string; volume: number } | null = null;
    for (const [date, volume] of dailyVolumes) {
      if (!bestDay || volume > bestDay.volume) {
        bestDay = { date, volume };
      }
    }

    const avgVolumePerDay =
      dailyVolumes.size > 0
        ? Math.round(totalVolume / dailyVolumes.size)
        : 0;

    // Regular vs Power stats
    const regularSessions = completedSessions.filter(
      (s) => s.sessionType === "regular"
    );
    const powerSessions = completedSessions.filter(
      (s) => s.sessionType === "power"
    );

    const regularVolume = regularSessions.reduce(
      (sum, s) => sum + (s.volume || 0),
      0
    );
    const powerVolume = powerSessions.reduce(
      (sum, s) => sum + (s.volume || 0),
      0
    );

    return {
      totalSessions: completedSessions.length,
      totalVolume,
      avgVolumePerSession:
        completedSessions.length > 0
          ? Math.round(totalVolume / completedSessions.length)
          : 0,
      avgVolumePerDay,
      bestSession: bestSession
        ? {
            volume: bestSession.volume || 0,
            date: bestSession.startTime,
            sessionType: bestSession.sessionType,
          }
        : null,
      bestDay,
      regularStats: {
        count: regularSessions.length,
        totalVolume: regularVolume,
        avgVolume:
          regularSessions.length > 0
            ? Math.round(regularVolume / regularSessions.length)
            : 0,
      },
      powerStats: {
        count: powerSessions.length,
        totalVolume: powerVolume,
        avgVolume:
          powerSessions.length > 0
            ? Math.round(powerVolume / powerSessions.length)
            : 0,
      },
    };
  },
});

// Adherence detail item for detailed breakdown
const adherenceDetailValidator = v.object({
  date: v.string(), // YYYY-MM-DD
  scheduledTime: v.string(), // HH:mm
  scheduledTimestamp: v.number(), // timestamp ms
  status: adherenceStatusValidator,
  latenessMinutes: v.optional(v.number()),
  sessionId: v.optional(v.id("pumpingSessions")),
});

// Get adherence stats for schedule compliance tracking
// Tracks: on-time, late, and missed sessions
export const getAdherenceStats = query({
  args: {
    days: v.number(), // Number of days to analyze
    lateThresholdMinutes: v.optional(v.number()), // Minutes after which a session is "late" (default: 15)
    clientTimezoneOffset: v.optional(v.number()), // Client timezone offset in minutes (for accurate day boundaries)
  },
  returns: v.object({
    // Summary counts
    onTime: v.number(),
    late: v.number(),
    missed: v.number(),
    total: v.number(), // Total scheduled slots in the period

    // Rates and averages
    adherenceRate: v.number(), // Percentage of completed sessions (on_time + late) / total * 100
    onTimeRate: v.number(), // Percentage of on-time sessions / total * 100
    avgLatenessMinutes: v.number(), // Average lateness for late sessions

    // Daily breakdown
    dailyStats: v.array(
      v.object({
        date: v.string(), // YYYY-MM-DD
        onTime: v.number(),
        late: v.number(),
        missed: v.number(),
        scheduled: v.number(), // Total scheduled for that day
      })
    ),

    // Detailed items (optional, for detailed view)
    details: v.array(adherenceDetailValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        onTime: 0,
        late: 0,
        missed: 0,
        total: 0,
        adherenceRate: 0,
        onTimeRate: 0,
        avgLatenessMinutes: 0,
        dailyStats: [],
        details: [],
      };
    }

    const lateThreshold = args.lateThresholdMinutes ?? 15;
    const timezoneOffset = args.clientTimezoneOffset ?? 0;

    // Get user preferences to access schedule
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // If no schedule configured, return empty stats
    if (!preferences?.sessionSchedule || preferences.sessionSchedule.length === 0) {
      return {
        onTime: 0,
        late: 0,
        missed: 0,
        total: 0,
        adherenceRate: 0,
        onTimeRate: 0,
        avgLatenessMinutes: 0,
        dailyStats: [],
        details: [],
      };
    }

    // Calculate date range
    const now = new Date();
    // Adjust for client timezone
    const clientNow = new Date(now.getTime() - timezoneOffset * 60 * 1000);

    // Start of today in client timezone
    const startOfToday = new Date(
      clientNow.getFullYear(),
      clientNow.getMonth(),
      clientNow.getDate()
    );

    // Start date (args.days ago)
    const startDate = new Date(startOfToday);
    startDate.setDate(startDate.getDate() - args.days + 1);

    // Get all sessions in the date range
    const sessions = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", userId).gte("startTime", startDate.getTime())
      )
      .collect();

    const completedSessions = sessions.filter((s) => s.status === "completed");

    // Build a map of schedule slot ID -> sessions for that slot
    const sessionsBySlot = new Map<string, typeof completedSessions>();
    const sessionsByScheduledTime = new Map<number, typeof completedSessions[0]>();

    for (const session of completedSessions) {
      if (session.scheduleSlotId) {
        const existing = sessionsBySlot.get(session.scheduleSlotId) || [];
        existing.push(session);
        sessionsBySlot.set(session.scheduleSlotId, existing);
      }
      if (session.scheduledTime) {
        sessionsByScheduledTime.set(session.scheduledTime, session);
      }
    }

    // Generate expected schedule slots for each day in the range
    const enabledSlots = preferences.sessionSchedule.filter((slot) => slot.enabled);

    let totalOnTime = 0;
    let totalLate = 0;
    let totalMissed = 0;
    let totalLateness = 0;
    let lateCount = 0;

    const dailyStatsMap = new Map<
      string,
      { onTime: number; late: number; missed: number; scheduled: number }
    >();
    const details: Array<{
      date: string;
      scheduledTime: string;
      scheduledTimestamp: number;
      status: "on_time" | "late" | "missed";
      latenessMinutes?: number;
      sessionId?: typeof completedSessions[0]["_id"];
    }> = [];

    // Iterate through each day in the range
    for (let dayOffset = 0; dayOffset < args.days; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split("T")[0];

      // Initialize daily stats
      if (!dailyStatsMap.has(dateStr)) {
        dailyStatsMap.set(dateStr, { onTime: 0, late: 0, missed: 0, scheduled: 0 });
      }
      const dayStats = dailyStatsMap.get(dateStr)!;

      // For each enabled schedule slot
      for (const slot of enabledSlots) {
        const [hours, minutes] = slot.time.split(":").map(Number);
        const scheduledTimestamp =
          currentDate.getTime() + (hours * 60 + minutes) * 60 * 1000;

        // Skip future slots
        if (scheduledTimestamp > now.getTime()) {
          continue;
        }

        dayStats.scheduled++;

        // Find matching session for this slot on this day
        // Try by scheduleSlotId first
        let matchingSession: typeof completedSessions[0] | undefined;

        if (slot.id) {
          const slotSessions = sessionsBySlot.get(slot.id) || [];
          matchingSession = slotSessions.find((s) => {
            const sessionDate = new Date(s.startTime).toISOString().split("T")[0];
            return sessionDate === dateStr;
          });
        }

        // Fallback: match by scheduledTime proximity
        if (!matchingSession) {
          matchingSession = sessionsByScheduledTime.get(scheduledTimestamp);
        }

        // Fallback: match by startTime proximity (within 2 hours of scheduled time)
        if (!matchingSession) {
          matchingSession = completedSessions.find((s) => {
            const sessionDate = new Date(s.startTime).toISOString().split("T")[0];
            if (sessionDate !== dateStr) return false;

            const timeDiff = Math.abs(s.startTime - scheduledTimestamp);
            return timeDiff < 2 * 60 * 60 * 1000; // Within 2 hours
          });
        }

        let status: "on_time" | "late" | "missed";
        let latenessMinutes: number | undefined;

        if (matchingSession) {
          // Determine if on-time or late
          latenessMinutes = matchingSession.latenessMinutes;

          if (latenessMinutes === undefined || latenessMinutes === null) {
            // Calculate lateness from startTime
            const diffMs = matchingSession.startTime - scheduledTimestamp;
            latenessMinutes = Math.max(0, Math.floor(diffMs / 60000));
          }

          if (latenessMinutes <= lateThreshold) {
            status = "on_time";
            totalOnTime++;
            dayStats.onTime++;
          } else {
            status = "late";
            totalLate++;
            dayStats.late++;
            totalLateness += latenessMinutes;
            lateCount++;
          }

          details.push({
            date: dateStr,
            scheduledTime: slot.time,
            scheduledTimestamp,
            status,
            latenessMinutes,
            sessionId: matchingSession._id,
          });
        } else {
          // No session found - check if past grace period (30 minutes)
          const gracePeriodMs = 30 * 60 * 1000;
          if (now.getTime() > scheduledTimestamp + gracePeriodMs) {
            status = "missed";
            totalMissed++;
            dayStats.missed++;

            details.push({
              date: dateStr,
              scheduledTime: slot.time,
              scheduledTimestamp,
              status,
            });
          }
        }
      }
    }

    const total = totalOnTime + totalLate + totalMissed;
    const completedCount = totalOnTime + totalLate;

    return {
      onTime: totalOnTime,
      late: totalLate,
      missed: totalMissed,
      total,
      adherenceRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
      onTimeRate: total > 0 ? Math.round((totalOnTime / total) * 100) : 0,
      avgLatenessMinutes: lateCount > 0 ? Math.round(totalLateness / lateCount) : 0,
      dailyStats: Array.from(dailyStatsMap.entries())
        .map(([date, stats]) => ({
          date,
          ...stats,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      details: details.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp),
    };
  },
});
