import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

describe("stats", () => {
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

  describe("getDailyStats", () => {
    it("should return empty stats when no sessions exist", async () => {
      const stats = await asUser.query(api.stats.getDailyStats, { days: 7 });

      expect(stats).toHaveLength(7);
      stats.forEach((day) => {
        expect(day.totalVolume).toBe(0);
        expect(day.sessionCount).toBe(0);
        expect(day.regularVolume).toBe(0);
        expect(day.powerVolume).toBe(0);
        expect(day.avgVolumePerSession).toBe(0);
      });
    });

    it("should calculate daily stats correctly", async () => {
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];

      // Create sessions for today
      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now - 3600000, // 1 hour ago
          endTime: now - 3000000,
          volume: 100,
          intervals: [],
          status: "completed",
        });

        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "power",
          startTime: now - 2000000,
          endTime: now - 1000000,
          volume: 80,
          intervals: [],
          status: "completed",
        });
      });

      const stats = await asUser.query(api.stats.getDailyStats, { days: 7 });

      const todayStats = stats.find((s) => s.date === today);
      expect(todayStats).toBeDefined();
      expect(todayStats?.totalVolume).toBe(180);
      expect(todayStats?.sessionCount).toBe(2);
      expect(todayStats?.regularVolume).toBe(100);
      expect(todayStats?.powerVolume).toBe(80);
      expect(todayStats?.avgVolumePerSession).toBe(90);
    });

    it("should not include in-progress sessions", async () => {
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now,
          volume: 50,
          intervals: [],
          status: "in_progress",
        });
      });

      const stats = await asUser.query(api.stats.getDailyStats, { days: 7 });

      const today = new Date().toISOString().split("T")[0];
      const todayStats = stats.find((s) => s.date === today);
      expect(todayStats?.sessionCount).toBe(0);
    });

    it("should return empty array when not authenticated", async () => {
      const stats = await t.query(api.stats.getDailyStats, { days: 7 });
      expect(stats).toEqual([]);
    });

    it("should handle sessions with no volume", async () => {
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now,
          endTime: now + 1000,
          intervals: [],
          status: "completed",
        });
      });

      const stats = await asUser.query(api.stats.getDailyStats, { days: 7 });

      const today = new Date().toISOString().split("T")[0];
      const todayStats = stats.find((s) => s.date === today);
      expect(todayStats?.sessionCount).toBe(1);
      expect(todayStats?.totalVolume).toBe(0);
    });
  });

  describe("getSummary", () => {
    it("should return zero stats when no sessions exist", async () => {
      const summary = await asUser.query(api.stats.getSummary, {});

      expect(summary.totalSessions).toBe(0);
      expect(summary.totalVolume).toBe(0);
      expect(summary.avgVolumePerSession).toBe(0);
      expect(summary.avgVolumePerDay).toBe(0);
      expect(summary.bestSession).toBeNull();
      expect(summary.bestDay).toBeNull();
      expect(summary.regularStats.count).toBe(0);
      expect(summary.powerStats.count).toBe(0);
    });

    it("should return zero stats when not authenticated", async () => {
      const summary = await t.query(api.stats.getSummary, {});

      expect(summary.totalSessions).toBe(0);
      expect(summary.bestSession).toBeNull();
    });

    it("should calculate summary correctly", async () => {
      const now = Date.now();
      const yesterday = now - 86400000;

      await t.run(async (ctx) => {
        // Today: 2 regular sessions
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now - 3600000,
          endTime: now - 3000000,
          volume: 120,
          intervals: [],
          status: "completed",
        });

        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now - 2000000,
          endTime: now - 1000000,
          volume: 80,
          intervals: [],
          status: "completed",
        });

        // Yesterday: 1 power session
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "power",
          startTime: yesterday,
          endTime: yesterday + 1000,
          volume: 150,
          intervals: [],
          status: "completed",
        });
      });

      const summary = await asUser.query(api.stats.getSummary, {});

      expect(summary.totalSessions).toBe(3);
      expect(summary.totalVolume).toBe(350); // 120 + 80 + 150

      // Average per session: 350 / 3 = 116.67 rounded to 117
      expect(summary.avgVolumePerSession).toBe(117);

      // 2 days with sessions, so avgVolumePerDay = 350 / 2 = 175
      expect(summary.avgVolumePerDay).toBe(175);

      // Best session is the 150ml power session
      expect(summary.bestSession?.volume).toBe(150);
      expect(summary.bestSession?.sessionType).toBe("power");

      // Regular stats
      expect(summary.regularStats.count).toBe(2);
      expect(summary.regularStats.totalVolume).toBe(200);
      expect(summary.regularStats.avgVolume).toBe(100);

      // Power stats
      expect(summary.powerStats.count).toBe(1);
      expect(summary.powerStats.totalVolume).toBe(150);
      expect(summary.powerStats.avgVolume).toBe(150);
    });

    it("should find the best day", async () => {
      const now = Date.now();
      const yesterday = now - 86400000;

      await t.run(async (ctx) => {
        // Today: total 100ml
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now,
          endTime: now + 1000,
          volume: 100,
          intervals: [],
          status: "completed",
        });

        // Yesterday: total 200ml
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: yesterday,
          endTime: yesterday + 1000,
          volume: 120,
          intervals: [],
          status: "completed",
        });

        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "power",
          startTime: yesterday + 3600000,
          endTime: yesterday + 3700000,
          volume: 80,
          intervals: [],
          status: "completed",
        });
      });

      const summary = await asUser.query(api.stats.getSummary, {});

      expect(summary.bestDay?.volume).toBe(200);
    });

    it("should not include in-progress sessions in summary", async () => {
      const now = Date.now();

      await t.run(async (ctx) => {
        // Completed session
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now,
          endTime: now + 1000,
          volume: 100,
          intervals: [],
          status: "completed",
        });

        // In-progress session (should be excluded)
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now + 2000,
          volume: 50,
          intervals: [],
          status: "in_progress",
        });
      });

      const summary = await asUser.query(api.stats.getSummary, {});

      expect(summary.totalSessions).toBe(1);
      expect(summary.totalVolume).toBe(100);
    });

    it("should handle sessions with zero or null volume", async () => {
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now,
          endTime: now + 1000,
          intervals: [],
          status: "completed",
        });

        await ctx.db.insert("pumpingSessions", {
          userId,
          sessionType: "regular",
          startTime: now + 2000,
          endTime: now + 3000,
          volume: 100,
          intervals: [],
          status: "completed",
        });
      });

      const summary = await asUser.query(api.stats.getSummary, {});

      expect(summary.totalSessions).toBe(2);
      expect(summary.totalVolume).toBe(100);
      expect(summary.avgVolumePerSession).toBe(50);
    });
  });
});
