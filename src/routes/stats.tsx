import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Trophy, TrendingUp, Droplets, Calendar, Clock, Zap } from "lucide-react";

export const Route = createFileRoute("/stats")({
  component: Stats,
});

type TimeRange = 7 | 14 | 30;

function Stats() {
  const [timeRange, setTimeRange] = useState<TimeRange>(7);

  const dailyStats = useQuery(api.stats.getDailyStats, { days: timeRange });
  const summary = useQuery(api.stats.getSummary);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">Track your progress over time</p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {([7, 14, 30] as TimeRange[]).map((days) => (
          <Button
            key={days}
            variant={timeRange === days ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange(days)}
          >
            {days} Days
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                Total Volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalVolume} ml</p>
              <p className="text-xs text-muted-foreground">
                {summary.totalSessions} sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Avg per Session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.avgVolumePerSession} ml</p>
              <p className="text-xs text-muted-foreground">
                {summary.avgVolumePerDay} ml/day avg
              </p>
            </CardContent>
          </Card>

          {summary.bestSession && (
            <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Trophy className="h-4 w-4" />
                  Best Session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {summary.bestSession.volume} ml
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                  {format(new Date(summary.bestSession.date), "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
          )}

          {summary.bestDay && (
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Calendar className="h-4 w-4" />
                  Best Day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {summary.bestDay.volume} ml
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70">
                  {format(parseISO(summary.bestDay.date), "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Daily Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Volume</CardTitle>
          <CardDescription>Volume pumped each day (ml)</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyStats === undefined ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : dailyStats.length === 0 ||
            dailyStats.every((d) => d.totalVolume === 0) ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(parseISO(date), "d")}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(date) =>
                    format(parseISO(date as string), "MMM d, yyyy")
                  }
                  formatter={(value) => [`${value} ml`, "Volume"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="totalVolume"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Regular vs Power Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regular vs Power</CardTitle>
          <CardDescription>Compare session types</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyStats === undefined ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : dailyStats.length === 0 ||
            dailyStats.every(
              (d) => d.regularVolume === 0 && d.powerVolume === 0
            ) ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(parseISO(date), "d")}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(date) =>
                    format(parseISO(date as string), "MMM d, yyyy")
                  }
                  formatter={(value, name) => [
                    `${value} ml`,
                    name === "regularVolume" ? "Regular" : "Power",
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === "regularVolume" ? "Regular" : "Power"
                  }
                />
                <Bar
                  dataKey="regularVolume"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  stackId="stack"
                />
                <Bar
                  dataKey="powerVolume"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  stackId="stack"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Session Type Comparison */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Clock className="h-4 w-4" />
                Regular Sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {summary.regularStats.count}
              </p>
              <p className="text-sm text-blue-600/70 dark:text-blue-400/70">
                {summary.regularStats.totalVolume} ml total
              </p>
              <p className="text-xs text-blue-600/50 dark:text-blue-400/50">
                {summary.regularStats.avgVolume} ml avg
              </p>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Zap className="h-4 w-4" />
                Power Sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                {summary.powerStats.count}
              </p>
              <p className="text-sm text-amber-600/70 dark:text-amber-400/70">
                {summary.powerStats.totalVolume} ml total
              </p>
              <p className="text-xs text-amber-600/50 dark:text-amber-400/50">
                {summary.powerStats.avgVolume} ml avg
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
