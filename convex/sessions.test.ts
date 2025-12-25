import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

describe("sessions", () => {
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

  describe("start", () => {
    it("should start a new regular session", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      expect(sessionId).toBeDefined();

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session).not.toBeNull();
      expect(session?.sessionType).toBe("regular");
      expect(session?.status).toBe("in_progress");
      expect(session?.userId).toBe(userId);
      expect(session?.intervals).toHaveLength(1);
      expect(session?.intervals[0].type).toBe("pump");
    });

    it("should start a new power session", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "power",
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session?.sessionType).toBe("power");
    });

    it("should start a scheduled session with timer config", async () => {
      const scheduledTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago

      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
        scheduleSlotId: "slot-1",
        scheduledTime,
        timerConfig: {
          pumpDuration: 900,
          restDuration: 300,
          cycles: 2,
        },
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session?.scheduleSlotId).toBe("slot-1");
      expect(session?.scheduledTime).toBe(scheduledTime);
      expect(session?.latenessMinutes).toBe(5);
      expect(session?.timerConfig).toEqual({
        pumpDuration: 900,
        restDuration: 300,
        cycles: 2,
      });
    });

    it("should prevent starting a session when one is already in progress", async () => {
      // Start first session
      await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      // Try to start another
      await expect(
        asUser.mutation(api.sessions.start, {
          sessionType: "regular",
        })
      ).rejects.toThrow("Sudah ada sesi yang sedang berjalan");
    });

    it("should throw error when not authenticated", async () => {
      await expect(
        t.mutation(api.sessions.start, {
          sessionType: "regular",
        })
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("switchInterval", () => {
    it("should switch from pump to rest", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.switchInterval, {
        sessionId,
        newIntervalType: "rest",
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session?.intervals).toHaveLength(2);
      expect(session?.intervals[0].endTime).toBeDefined();
      expect(session?.intervals[1].type).toBe("rest");
    });

    it("should switch from rest to pump", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.switchInterval, {
        sessionId,
        newIntervalType: "rest",
      });

      await asUser.mutation(api.sessions.switchInterval, {
        sessionId,
        newIntervalType: "pump",
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session?.intervals).toHaveLength(3);
      expect(session?.intervals[2].type).toBe("pump");
    });

    it("should throw error for non-existent session", async () => {
      const fakeId = await t.run(async (ctx) => {
        // Create and delete a session to get a valid but non-existent ID format
        const id = await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: Date.now(),
          intervals: [],
          status: "in_progress",
        });
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        asUser.mutation(api.sessions.switchInterval, {
          sessionId: fakeId,
          newIntervalType: "rest",
        })
      ).rejects.toThrow("Session not found");
    });
  });

  describe("complete", () => {
    it("should complete a session with volume", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.complete, {
        sessionId,
        volume: 120,
        notes: "Good session",
        isCompleted: true,
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session?.status).toBe("completed");
      expect(session?.volume).toBe(120);
      expect(session?.notes).toBe("Good session");
      expect(session?.isCompleted).toBe(true);
      expect(session?.endTime).toBeDefined();
      expect(session?.totalPumpDuration).toBeDefined();
    });

    it("should calculate total pump and rest durations", async () => {
      // Create session with known intervals - all intervals already closed
      const now = Date.now();
      const sessionId = await t.run(async (ctx) => {
        return await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now - 150000, // 2.5 min ago
          intervals: [
            { type: "pump", startTime: now - 150000, endTime: now - 90000 }, // 60 seconds pump
            { type: "rest", startTime: now - 90000, endTime: now - 60000 }, // 30 seconds rest
            { type: "pump", startTime: now - 60000 }, // Currently in last pump (still open)
          ],
          status: "in_progress",
        });
      });

      await asUser.mutation(api.sessions.complete, {
        sessionId,
        volume: 100,
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session?.totalRestDuration).toBe(30); // 30 seconds
      // totalPumpDuration: 60 seconds from first pump + ~60 seconds from last pump
      expect(session?.totalPumpDuration).toBeGreaterThanOrEqual(60);
    });

    it("should default isCompleted to true if not specified", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.complete, {
        sessionId,
        volume: 100,
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session?.isCompleted).toBe(true);
    });
  });

  describe("getCurrent", () => {
    it("should return current in-progress session", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      const current = await asUser.query(api.sessions.getCurrent, {});

      expect(current).not.toBeNull();
      expect(current?._id).toBe(sessionId);
      expect(current?.status).toBe("in_progress");
    });

    it("should return null when no session is in progress", async () => {
      const current = await asUser.query(api.sessions.getCurrent, {});
      expect(current).toBeNull();
    });

    it("should return null after session is completed", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.complete, {
        sessionId,
        volume: 100,
      });

      const current = await asUser.query(api.sessions.getCurrent, {});
      expect(current).toBeNull();
    });
  });

  describe("getToday", () => {
    it("should return today's completed sessions", async () => {
      // Create and complete a session
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.complete, {
        sessionId,
        volume: 100,
      });

      const sessions = await asUser.query(api.sessions.getToday, {});

      expect(sessions).toHaveLength(1);
      expect(sessions[0].volume).toBe(100);
    });

    it("should not return in-progress sessions", async () => {
      await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      const sessions = await asUser.query(api.sessions.getToday, {});
      expect(sessions).toHaveLength(0);
    });

    it("should return empty array when not authenticated", async () => {
      const sessions = await t.query(api.sessions.getToday, {});
      expect(sessions).toEqual([]);
    });
  });

  describe("getByDateRange", () => {
    it("should return sessions within date range", async () => {
      const now = Date.now();
      const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

      // Create a completed session
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.complete, {
        sessionId,
        volume: 100,
      });

      const sessions = await asUser.query(api.sessions.getByDateRange, {
        startDate: startOfDay,
        endDate: now + 86400000, // End of today
      });

      expect(sessions).toHaveLength(1);
    });

    it("should return all sessions when startDate is 0", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.complete, {
        sessionId,
        volume: 100,
      });

      const sessions = await asUser.query(api.sessions.getByDateRange, {
        startDate: 0,
        endDate: Date.now() + 86400000,
      });

      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getById", () => {
    it("should return session by ID", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      const session = await asUser.query(api.sessions.getById, {
        sessionId,
      });

      expect(session).not.toBeNull();
      expect(session?._id).toBe(sessionId);
    });

    it("should return null for other user's session", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      // Create another user and their accessor
      const otherUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {});
      });
      const asOtherUser = t.withIdentity({ subject: otherUserId });

      const session = await asOtherUser.query(api.sessions.getById, {
        sessionId,
      });

      expect(session).toBeNull();
    });
  });

  describe("remove", () => {
    it("should delete a session", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.remove, {
        sessionId,
      });

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session).toBeNull();
    });

    it("should throw error when deleting other user's session", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      const otherUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {});
      });
      const asOtherUser = t.withIdentity({ subject: otherUserId });

      await expect(
        asOtherUser.mutation(api.sessions.remove, {
          sessionId,
        })
      ).rejects.toThrow("Session not found");
    });
  });

  describe("cancelCurrent", () => {
    it("should delete current in-progress session", async () => {
      const sessionId = await asUser.mutation(api.sessions.start, {
        sessionType: "regular",
      });

      await asUser.mutation(api.sessions.cancelCurrent, {});

      const session = await t.run(async (ctx) => {
        return await ctx.db.get(sessionId);
      });

      expect(session).toBeNull();
    });

    it("should do nothing when no session is in progress", async () => {
      // Should not throw
      await asUser.mutation(api.sessions.cancelCurrent, {});
    });
  });

  describe("cleanupOrphanedSessions", () => {
    it("should delete stale in-progress sessions (older than threshold)", async () => {
      const now = Date.now();
      const threeHoursAgo = now - 3 * 60 * 60 * 1000;

      // Create stale in-progress sessions
      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: threeHoursAgo,
          intervals: [],
          status: "in_progress",
        });
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "power",
          startTime: threeHoursAgo - 60 * 60 * 1000, // 4 hours ago
          intervals: [],
          status: "in_progress",
        });
      });

      const deleted = await t.mutation(internal.sessions.cleanupOrphanedSessions, {});

      expect(deleted).toBe(2);
    });

    it("should not delete recent in-progress sessions", async () => {
      const now = Date.now();
      const thirtyMinutesAgo = now - 30 * 60 * 1000;

      // Create a recent in-progress session (not stale yet)
      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: thirtyMinutesAgo,
          intervals: [],
          status: "in_progress",
        });
      });

      const deleted = await t.mutation(internal.sessions.cleanupOrphanedSessions, {});

      expect(deleted).toBe(0);
    });

    it("should not delete completed sessions", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
          endTime: Date.now() - 5 * 60 * 60 * 1000 + 1000,
          intervals: [],
          status: "completed",
          volume: 100,
        });
      });

      const deleted = await t.mutation(internal.sessions.cleanupOrphanedSessions, {});

      expect(deleted).toBe(0);
    });

    it("should respect custom maxAgeMs parameter", async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: oneHourAgo,
          intervals: [],
          status: "in_progress",
        });
      });

      // With default 2-hour threshold, should not delete
      let deleted = await t.mutation(internal.sessions.cleanupOrphanedSessions, {});
      expect(deleted).toBe(0);

      // With 30-minute threshold, should delete
      deleted = await t.mutation(internal.sessions.cleanupOrphanedSessions, {
        maxAgeMs: 30 * 60 * 1000,
      });
      expect(deleted).toBe(1);
    });
  });

  describe("cleanupStaleSessions", () => {
    it("should delete user's stale in-progress sessions", async () => {
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;

      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: threeHoursAgo,
          intervals: [],
          status: "in_progress",
        });
      });

      const deleted = await asUser.mutation(api.sessions.cleanupStaleSessions, {});

      expect(deleted).toBe(1);
    });

    it("should not delete other user's sessions", async () => {
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;

      // Create stale session for another user
      const otherUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {});
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId: otherUserId,
          sessionType: "regular",
          startTime: threeHoursAgo,
          intervals: [],
          status: "in_progress",
        });
      });

      const deleted = await asUser.mutation(api.sessions.cleanupStaleSessions, {});

      expect(deleted).toBe(0);
    });

    it("should throw error when not authenticated", async () => {
      await expect(
        t.mutation(api.sessions.cleanupStaleSessions, {})
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("getTodayScheduleStatus", () => {
    it("should return empty array when user has no schedule", async () => {
      const result = await asUser.query(api.sessions.getTodayScheduleStatus, {});
      expect(result).toEqual([]);
    });

    it("should return schedule status with pending items", async () => {
      // Set up user preferences with schedule
      const now = new Date();
      const futureTime = `${String(now.getHours() + 1).padStart(2, '0')}:00`;

      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
          sessionSchedule: [
            { id: "slot-1", time: futureTime, enabled: true, sessionType: "regular" },
          ],
        });
      });

      const clientNow = Date.now();
      const clientStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const result = await asUser.query(api.sessions.getTodayScheduleStatus, {
        clientNow,
        clientStartOfDay,
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("pending");
      expect(result[0].scheduleSlotId).toBe("slot-1");
    });

    it("should mark past schedules as missed", async () => {
      const now = new Date();
      // Set time 2 hours ago (past the 30-min grace period)
      const pastHour = now.getHours() - 2;
      const pastTime = `${String(pastHour >= 0 ? pastHour : 0).padStart(2, '0')}:00`;

      if (pastHour >= 0) {
        await t.run(async (ctx) => {
          await ctx.db.insert("userPreferences", {
            userId,
            onboardingCompleted: true,
            alertVolume: 100,
            sessionSchedule: [
              { id: "slot-1", time: pastTime, enabled: true, sessionType: "regular" },
            ],
          });
        });

        const clientNow = Date.now();
        const clientStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const result = await asUser.query(api.sessions.getTodayScheduleStatus, {
          clientNow,
          clientStartOfDay,
        });

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("missed");
      }
    });

    it("should skip disabled schedule slots", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("userPreferences", {
          userId,
          onboardingCompleted: true,
          alertVolume: 100,
          sessionSchedule: [
            { id: "slot-1", time: "10:00", enabled: false, sessionType: "regular" },
          ],
        });
      });

      const result = await asUser.query(api.sessions.getTodayScheduleStatus, {});
      expect(result).toHaveLength(0);
    });
  });
});
