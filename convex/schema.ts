import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Interval within a pumping session (pump or rest period)
const intervalValidator = v.object({
  type: v.union(v.literal("pump"), v.literal("rest")),
  startTime: v.number(), // timestamp ms
  endTime: v.optional(v.number()), // timestamp ms
});

// Timer configuration per session (legacy format for backward compatibility)
const legacyTimerConfigValidator = v.object({
  pumpDuration: v.number(), // seconds
  restDuration: v.number(), // seconds
  cycles: v.number(), // number of pump-rest cycles
});

// Custom interval for step-by-step builder
const customIntervalValidator = v.object({
  id: v.string(), // UUID for stable identification
  type: v.union(v.literal("pump"), v.literal("rest")),
  duration: v.number(), // seconds
});

// Timer configuration V2 - supports both simple and custom modes
const timerConfigV2Validator = v.object({
  mode: v.union(v.literal("simple"), v.literal("custom")),
  // Always present - the actual interval sequence to execute
  intervals: v.array(customIntervalValidator),
  // Simple mode reference values (used when mode="simple")
  pumpDuration: v.optional(v.number()), // seconds
  restDuration: v.optional(v.number()), // seconds
  cycles: v.optional(v.number()),
});

// Combined validator that accepts both old and new formats
const timerConfigValidator = v.union(legacyTimerConfigValidator, timerConfigV2Validator);

// Schedule item with session type (id and sessionType optional for backward compatibility)
const scheduleItemValidator = v.object({
  id: v.optional(v.string()), // UUID for stable identification
  time: v.string(), // "HH:mm" format like "06:00", "09:00"
  enabled: v.boolean(), // allow disabling individual slots
  sessionType: v.optional(v.union(v.literal("regular"), v.literal("power"))), // defaults to "regular"
});

export default defineSchema({
  ...authTables,

  // Pumping sessions
  pumpingSessions: defineTable({
    userId: v.id("users"),
    sessionType: v.union(v.literal("regular"), v.literal("power")),
    startTime: v.number(), // timestamp ms
    endTime: v.optional(v.number()), // timestamp ms
    volume: v.optional(v.number()), // ml
    intervals: v.array(intervalValidator),
    totalPumpDuration: v.optional(v.number()), // seconds
    totalRestDuration: v.optional(v.number()), // seconds
    notes: v.optional(v.string()),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    // NEW: Schedule-linked fields
    scheduleSlotId: v.optional(v.string()), // ID of the schedule slot (null for ad-hoc)
    scheduledTime: v.optional(v.number()), // timestamp ms - the scheduled time for today
    latenessMinutes: v.optional(v.number()), // 0 = on time, >0 = late by N minutes
    isCompleted: v.optional(v.boolean()), // tuntas (true) or tidak tuntas (false)
    timerConfig: v.optional(timerConfigValidator), // config used for this session
  })
    .index("by_user_and_time", ["userId", "startTime"])
    .index("by_user_and_status_and_time", ["userId", "status", "startTime"]),

  // User preferences for pump durations
  userPreferences: defineTable({
    userId: v.id("users"),
    onboardingCompleted: v.boolean(),
    // Legacy fields (kept for backward compatibility)
    regularPumpDuration: v.optional(v.number()), // seconds
    regularRestDuration: v.optional(v.number()), // seconds
    powerPumpDuration: v.optional(v.number()), // seconds
    powerRestDuration: v.optional(v.number()), // seconds
    // NEW: Default timer settings (used as initial values, can be overridden per session)
    defaultPumpDuration: v.optional(v.number()), // seconds (e.g., 900 = 15 min)
    defaultRestDuration: v.optional(v.number()), // seconds (e.g., 300 = 5 min)
    defaultCycles: v.optional(v.number()), // e.g., 2 or 3
    // Alert settings
    alertVolume: v.number(), // 0-100
    // NEW: Session schedule with session types
    sessionSchedule: v.optional(v.array(scheduleItemValidator)),
    notificationsEnabled: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
});
