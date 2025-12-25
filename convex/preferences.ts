import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Validate time format (HH:mm) - returns true if valid
function isValidTimeFormat(time: string): boolean {
  if (typeof time !== "string") return false;
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

// Validate schedule items array - returns error message or null if valid
function validateScheduleItems(
  items: Array<{ time: string; enabled: boolean }>
): string | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!isValidTimeFormat(item.time)) {
      return `Invalid time format at position ${i + 1}: "${item.time}". Expected HH:mm format (e.g., 06:00, 14:30)`;
    }
  }
  return null;
}

// Session schedule item validator (id and sessionType optional for backward compatibility)
const scheduleItemValidator = v.object({
  id: v.optional(v.string()), // UUID for stable identification
  time: v.string(), // "HH:mm" format
  enabled: v.boolean(),
  sessionType: v.optional(v.union(v.literal("regular"), v.literal("power"))),
});

// Return type for preferences - includes both legacy and new fields
const preferencesValidator = v.object({
  _id: v.id("userPreferences"),
  _creationTime: v.number(),
  userId: v.id("users"),
  onboardingCompleted: v.boolean(),
  // Legacy fields (may not exist in new data)
  regularPumpDuration: v.optional(v.number()),
  regularRestDuration: v.optional(v.number()),
  powerPumpDuration: v.optional(v.number()),
  powerRestDuration: v.optional(v.number()),
  // NEW: Default timer settings
  defaultPumpDuration: v.optional(v.number()),
  defaultRestDuration: v.optional(v.number()),
  defaultCycles: v.optional(v.number()),
  // Alert settings
  alertVolume: v.number(),
  // Schedule - can be old format or new format
  sessionSchedule: v.optional(v.array(v.any())),
  notificationsEnabled: v.optional(v.boolean()),
});

// Get user preferences
export const get = query({
  args: {},
  returns: v.union(preferencesValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return preferences;
  },
});

// NEW: Get default timer settings for session start
export const getDefaults = query({
  args: {},
  returns: v.object({
    pumpDuration: v.number(), // seconds
    restDuration: v.number(), // seconds
    cycles: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Return sensible defaults for unauthenticated users
      return {
        pumpDuration: 900, // 15 minutes
        restDuration: 300, // 5 minutes
        cycles: 2,
      };
    }

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!preferences) {
      return {
        pumpDuration: 900,
        restDuration: 300,
        cycles: 2,
      };
    }

    // Use new fields if available, fall back to legacy fields
    return {
      pumpDuration:
        preferences.defaultPumpDuration ??
        preferences.regularPumpDuration ??
        900,
      restDuration:
        preferences.defaultRestDuration ??
        preferences.regularRestDuration ??
        300,
      cycles: preferences.defaultCycles ?? 2,
    };
  },
});

// Create or update user preferences (used in onboarding and settings)
export const save = mutation({
  args: {
    // NEW: Simplified default timer settings
    defaultPumpDuration: v.optional(v.number()),
    defaultRestDuration: v.optional(v.number()),
    defaultCycles: v.optional(v.number()),
    // Legacy fields (for backward compatibility during transition)
    regularPumpDuration: v.optional(v.number()),
    regularRestDuration: v.optional(v.number()),
    powerPumpDuration: v.optional(v.number()),
    powerRestDuration: v.optional(v.number()),
    // Other settings
    alertVolume: v.optional(v.number()),
    sessionSchedule: v.optional(v.array(scheduleItemValidator)),
    notificationsEnabled: v.optional(v.boolean()),
  },
  returns: v.id("userPreferences"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate schedule time formats
    if (args.sessionSchedule) {
      const validationError = validateScheduleItems(args.sessionSchedule);
      if (validationError) {
        throw new Error(validationError);
      }
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // Build update/insert data
    const data: Record<string, unknown> = {
      onboardingCompleted: true,
      alertVolume: args.alertVolume ?? existing?.alertVolume ?? 100,
    };

    // Handle new default fields
    if (args.defaultPumpDuration !== undefined) {
      data.defaultPumpDuration = args.defaultPumpDuration;
    }
    if (args.defaultRestDuration !== undefined) {
      data.defaultRestDuration = args.defaultRestDuration;
    }
    if (args.defaultCycles !== undefined) {
      data.defaultCycles = args.defaultCycles;
    }

    // Handle legacy fields (for backward compatibility)
    if (args.regularPumpDuration !== undefined) {
      data.regularPumpDuration = args.regularPumpDuration;
      // Also set as new default if not specified
      if (args.defaultPumpDuration === undefined) {
        data.defaultPumpDuration = args.regularPumpDuration;
      }
    }
    if (args.regularRestDuration !== undefined) {
      data.regularRestDuration = args.regularRestDuration;
      if (args.defaultRestDuration === undefined) {
        data.defaultRestDuration = args.regularRestDuration;
      }
    }
    if (args.powerPumpDuration !== undefined) {
      data.powerPumpDuration = args.powerPumpDuration;
    }
    if (args.powerRestDuration !== undefined) {
      data.powerRestDuration = args.powerRestDuration;
    }

    // Handle schedule
    if (args.sessionSchedule !== undefined) {
      data.sessionSchedule = args.sessionSchedule;
    }
    if (args.notificationsEnabled !== undefined) {
      data.notificationsEnabled = args.notificationsEnabled;
    }

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    // For new insert, we need explicit fields
    return await ctx.db.insert("userPreferences", {
      userId,
      onboardingCompleted: true,
      alertVolume: args.alertVolume ?? 100,
      defaultPumpDuration: args.defaultPumpDuration ?? args.regularPumpDuration,
      defaultRestDuration: args.defaultRestDuration ?? args.regularRestDuration,
      defaultCycles: args.defaultCycles,
      regularPumpDuration: args.regularPumpDuration,
      regularRestDuration: args.regularRestDuration,
      powerPumpDuration: args.powerPumpDuration,
      powerRestDuration: args.powerRestDuration,
      sessionSchedule: args.sessionSchedule,
      notificationsEnabled: args.notificationsEnabled,
    });
  },
});

// Update alert volume only
export const updateAlertVolume = mutation({
  args: {
    alertVolume: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!existing) {
      throw new Error("Preferences not found. Complete onboarding first.");
    }

    await ctx.db.patch(existing._id, {
      alertVolume: args.alertVolume,
    });

    return null;
  },
});

// Update session schedule only (with new format including sessionType)
export const updateSchedule = mutation({
  args: {
    sessionSchedule: v.array(scheduleItemValidator),
    notificationsEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate schedule time formats
    const validationError = validateScheduleItems(args.sessionSchedule);
    if (validationError) {
      throw new Error(validationError);
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!existing) {
      throw new Error("Preferences not found. Complete onboarding first.");
    }

    await ctx.db.patch(existing._id, {
      sessionSchedule: args.sessionSchedule,
      notificationsEnabled: args.notificationsEnabled,
    });

    return null;
  },
});

// Update default timer settings
export const updateDefaults = mutation({
  args: {
    defaultPumpDuration: v.number(),
    defaultRestDuration: v.number(),
    defaultCycles: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!existing) {
      throw new Error("Preferences not found. Complete onboarding first.");
    }

    await ctx.db.patch(existing._id, {
      defaultPumpDuration: args.defaultPumpDuration,
      defaultRestDuration: args.defaultRestDuration,
      defaultCycles: args.defaultCycles,
    });

    return null;
  },
});
