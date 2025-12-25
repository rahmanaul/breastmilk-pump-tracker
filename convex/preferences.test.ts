import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

describe("preferences", () => {
  let t: ReturnType<typeof convexTest>;
  let userId: Id<"users">;
  let asUser: ReturnType<typeof convexTest>["withIdentity"] extends (arg: unknown) => infer R ? R : never;

  beforeEach(async () => {
    t = convexTest(schema);
    // Create a test user
    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {});
    });
    // Create authenticated accessor with proper subject containing user ID
    asUser = t.withIdentity({ subject: userId });
  });

  describe("get", () => {
    it("should return null when user has no preferences", async () => {
      const prefs = await asUser.query(api.preferences.get, {});
      expect(prefs).toBeNull();
    });

    it("should return preferences when they exist", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 80,
          defaultPumpDuration: 900,
          defaultRestDuration: 300,
          defaultCycles: 2,
        });
      });

      const prefs = await asUser.query(api.preferences.get, {});

      expect(prefs).not.toBeNull();
      expect(prefs?.onboardingCompleted).toBe(true);
      expect(prefs?.alertVolume).toBe(80);
      expect(prefs?.defaultPumpDuration).toBe(900);
    });

    it("should return null when not authenticated", async () => {
      const prefs = await t.query(api.preferences.get, {});
      expect(prefs).toBeNull();
    });
  });

  describe("getDefaults", () => {
    it("should return default values when not authenticated", async () => {
      const defaults = await t.query(api.preferences.getDefaults, {});

      expect(defaults.pumpDuration).toBe(900);
      expect(defaults.restDuration).toBe(300);
      expect(defaults.cycles).toBe(2);
    });

    it("should return default values when user has no preferences", async () => {
      const defaults = await asUser.query(api.preferences.getDefaults, {});

      expect(defaults.pumpDuration).toBe(900);
      expect(defaults.restDuration).toBe(300);
      expect(defaults.cycles).toBe(2);
    });

    it("should return user's custom default values", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
          defaultPumpDuration: 1200,
          defaultRestDuration: 600,
          defaultCycles: 3,
        });
      });

      const defaults = await asUser.query(api.preferences.getDefaults, {});

      expect(defaults.pumpDuration).toBe(1200);
      expect(defaults.restDuration).toBe(600);
      expect(defaults.cycles).toBe(3);
    });

    it("should fall back to legacy fields if new fields not set", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
          regularPumpDuration: 1000,
          regularRestDuration: 400,
        });
      });

      const defaults = await asUser.query(api.preferences.getDefaults, {});

      expect(defaults.pumpDuration).toBe(1000);
      expect(defaults.restDuration).toBe(400);
      expect(defaults.cycles).toBe(2); // Default
    });
  });

  describe("save", () => {
    it("should create new preferences", async () => {
      const prefsId = await asUser.mutation(api.preferences.save, {
        defaultPumpDuration: 900,
        defaultRestDuration: 300,
        defaultCycles: 2,
        alertVolume: 80,
      });

      expect(prefsId).toBeDefined();

      const prefs = await t.run(async (ctx) => {
        return await ctx.db.get(prefsId);
      });

      expect(prefs?.onboardingCompleted).toBe(true);
      expect(prefs?.defaultPumpDuration).toBe(900);
      expect(prefs?.alertVolume).toBe(80);
    });

    it("should update existing preferences", async () => {
      // Create initial preferences
      const prefsId = await t.run(async (ctx) => {
        return await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 50,
          defaultPumpDuration: 600,
        });
      });

      // Update them
      await asUser.mutation(api.preferences.save, {
        defaultPumpDuration: 1200,
        alertVolume: 100,
      });

      const prefs = await t.run(async (ctx) => {
        return await ctx.db.get(prefsId);
      });

      expect(prefs?.defaultPumpDuration).toBe(1200);
      expect(prefs?.alertVolume).toBe(100);
    });

    it("should save schedule with session types", async () => {
      await asUser.mutation(api.preferences.save, {
        alertVolume: 100,
        sessionSchedule: [
          { id: "slot-1", time: "06:00", enabled: true, sessionType: "regular" },
          { id: "slot-2", time: "09:00", enabled: true, sessionType: "power" },
        ],
      });

      const prefs = await asUser.query(api.preferences.get, {});

      expect(prefs?.sessionSchedule).toHaveLength(2);
      expect(prefs?.sessionSchedule?.[0].sessionType).toBe("regular");
      expect(prefs?.sessionSchedule?.[1].sessionType).toBe("power");
    });

    it("should throw error when not authenticated", async () => {
      await expect(
        t.mutation(api.preferences.save, {
          alertVolume: 100,
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("should set defaultPumpDuration from regularPumpDuration if not specified", async () => {
      await asUser.mutation(api.preferences.save, {
        regularPumpDuration: 1100,
        regularRestDuration: 500,
        alertVolume: 100,
      });

      const prefs = await asUser.query(api.preferences.get, {});

      expect(prefs?.defaultPumpDuration).toBe(1100);
      expect(prefs?.defaultRestDuration).toBe(500);
    });

    it("should reject invalid time format in schedule", async () => {
      await expect(
        asUser.mutation(api.preferences.save, {
          alertVolume: 100,
          sessionSchedule: [
            { id: "slot-1", time: "invalid", enabled: true, sessionType: "regular" },
          ],
        })
      ).rejects.toThrow("Invalid time format");
    });

    it("should accept valid time formats in schedule", async () => {
      await asUser.mutation(api.preferences.save, {
        alertVolume: 100,
        sessionSchedule: [
          { id: "slot-1", time: "06:00", enabled: true, sessionType: "regular" },
          { id: "slot-2", time: "9:30", enabled: true, sessionType: "power" },
        ],
      });

      const prefs = await asUser.query(api.preferences.get, {});
      expect(prefs?.sessionSchedule).toHaveLength(2);
    });
  });

  describe("updateAlertVolume", () => {
    it("should update alert volume", async () => {
      // Create preferences first
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 50,
        });
      });

      await asUser.mutation(api.preferences.updateAlertVolume, {
        alertVolume: 75,
      });

      const prefs = await asUser.query(api.preferences.get, {});
      expect(prefs?.alertVolume).toBe(75);
    });

    it("should throw error if preferences don't exist", async () => {
      await expect(
        asUser.mutation(api.preferences.updateAlertVolume, {
          alertVolume: 75,
        })
      ).rejects.toThrow("Preferences not found");
    });
  });

  describe("updateSchedule", () => {
    it("should update session schedule", async () => {
      // Create preferences first
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
        });
      });

      await asUser.mutation(api.preferences.updateSchedule, {
        sessionSchedule: [
          { id: "slot-1", time: "07:00", enabled: true, sessionType: "regular" },
          { id: "slot-2", time: "10:00", enabled: false, sessionType: "power" },
        ],
        notificationsEnabled: true,
      });

      const prefs = await asUser.query(api.preferences.get, {});

      expect(prefs?.sessionSchedule).toHaveLength(2);
      expect(prefs?.sessionSchedule?.[0].time).toBe("07:00");
      expect(prefs?.notificationsEnabled).toBe(true);
    });

    it("should throw error if preferences don't exist", async () => {
      await expect(
        asUser.mutation(api.preferences.updateSchedule, {
          sessionSchedule: [],
          notificationsEnabled: false,
        })
      ).rejects.toThrow("Preferences not found");
    });

    it("should reject invalid time format", async () => {
      // Create preferences first
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
        });
      });

      // Invalid time format: 25:00
      await expect(
        asUser.mutation(api.preferences.updateSchedule, {
          sessionSchedule: [
            { id: "slot-1", time: "25:00", enabled: true, sessionType: "regular" },
          ],
          notificationsEnabled: false,
        })
      ).rejects.toThrow("Invalid time format");
    });

    it("should reject invalid minutes", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
        });
      });

      // Invalid minutes: 06:60
      await expect(
        asUser.mutation(api.preferences.updateSchedule, {
          sessionSchedule: [
            { id: "slot-1", time: "06:60", enabled: true, sessionType: "regular" },
          ],
          notificationsEnabled: false,
        })
      ).rejects.toThrow("Invalid time format");
    });

    it("should accept valid time formats", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
        });
      });

      // Valid times: 00:00, 6:30, 12:45, 23:59
      await asUser.mutation(api.preferences.updateSchedule, {
        sessionSchedule: [
          { id: "slot-1", time: "00:00", enabled: true, sessionType: "regular" },
          { id: "slot-2", time: "6:30", enabled: true, sessionType: "regular" },
          { id: "slot-3", time: "12:45", enabled: true, sessionType: "power" },
          { id: "slot-4", time: "23:59", enabled: true, sessionType: "regular" },
        ],
        notificationsEnabled: false,
      });

      const prefs = await asUser.query(api.preferences.get, {});
      expect(prefs?.sessionSchedule).toHaveLength(4);
    });
  });

  describe("updateDefaults", () => {
    it("should update default timer settings", async () => {
      // Create preferences first
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
        });
      });

      await asUser.mutation(api.preferences.updateDefaults, {
        defaultPumpDuration: 1500,
        defaultRestDuration: 450,
        defaultCycles: 4,
      });

      const prefs = await asUser.query(api.preferences.get, {});

      expect(prefs?.defaultPumpDuration).toBe(1500);
      expect(prefs?.defaultRestDuration).toBe(450);
      expect(prefs?.defaultCycles).toBe(4);
    });

    it("should throw error if preferences don't exist", async () => {
      await expect(
        asUser.mutation(api.preferences.updateDefaults, {
          defaultPumpDuration: 900,
          defaultRestDuration: 300,
          defaultCycles: 2,
        })
      ).rejects.toThrow("Preferences not found");
    });
  });
});
