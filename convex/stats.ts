import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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
  args: {},
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
  handler: async (ctx) => {
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

    const sessions = await ctx.db
      .query("pumpingSessions")
      .withIndex("by_user_and_time", (q) => q.eq("userId", userId))
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
