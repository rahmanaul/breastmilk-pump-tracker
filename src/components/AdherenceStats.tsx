import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Target,
  AlertTriangle,
} from "lucide-react";
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
import { id } from "date-fns/locale";
import { useInView } from "react-intersection-observer";
import { useMemo } from "react";

interface AdherenceStatsProps {
  days: number;
}

// Tooltip style for consistency with other charts
const tooltipStyle = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

// Status colors
const STATUS_COLORS = {
  onTime: "#22c55e", // green-500
  late: "#f59e0b", // amber-500
  missed: "#ef4444", // red-500
};

// Memoized formatters for chart performance (outside component to avoid recreation)
const dateTickFormatter = (date: string) => {
  try {
    return format(parseISO(date), "d", { locale: id });
  } catch {
    return date;
  }
};

const dateLabelFormatter = (date: string | number) => {
  try {
    return format(parseISO(date as string), "d MMM yyyy", { locale: id });
  } catch {
    return String(date);
  }
};

export function AdherenceStats({ days }: AdherenceStatsProps) {
  const adherenceStats = useQuery(api.stats.getAdherenceStats, {
    days,
    lateThresholdMinutes: 15,
  });

  const { ref: chartRef, inView: chartInView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  // Prepare chart data - use dailyStats directly for stability
  const dailyStats = adherenceStats?.dailyStats;
  const chartData = useMemo(() => {
    if (!dailyStats) return [];
    return dailyStats.map((day) => ({
      date: day.date,
      "Tepat Waktu": day.onTime,
      Terlambat: day.late,
      Terlewat: day.missed,
    }));
  }, [dailyStats]);

  const hasChartData = useMemo(() => {
    return chartData.some(
      (d) => d["Tepat Waktu"] > 0 || d["Terlambat"] > 0 || d["Terlewat"] > 0
    );
  }, [chartData]);

  if (adherenceStats === undefined) {
    return <AdherenceStatsSkeleton />;
  }

  // If no schedule configured, show a message
  if (adherenceStats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5" />
            Kepatuhan Jadwal
          </CardTitle>
          <CardDescription>
            Belum ada jadwal yang dikonfigurasi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Atur jadwal pumping di halaman Pengaturan untuk melihat statistik
            kepatuhan.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Adherence Rate Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5" />
            Kepatuhan Jadwal
          </CardTitle>
          <CardDescription>
            Statistik ketepatan waktu pumping ({days} hari terakhir)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Stats */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{adherenceStats.adherenceRate}%</p>
              <p className="text-sm text-muted-foreground">Tingkat Kepatuhan</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-green-600">
                {adherenceStats.onTimeRate}%
              </p>
              <p className="text-sm text-muted-foreground">Tepat Waktu</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {adherenceStats.onTime + adherenceStats.late} dari{" "}
                {adherenceStats.total} sesi
              </span>
              <span>{adherenceStats.missed} terlewat</span>
            </div>
            <Progress
              value={adherenceStats.adherenceRate}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* On-Time Card */}
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Tepat Waktu</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {adherenceStats.onTime}
            </p>
          </CardContent>
        </Card>

        {/* Late Card */}
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Terlambat</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {adherenceStats.late}
            </p>
            {adherenceStats.avgLatenessMinutes > 0 && (
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                ~{adherenceStats.avgLatenessMinutes} menit
              </p>
            )}
          </CardContent>
        </Card>

        {/* Missed Card */}
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-xs">Terlewat</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {adherenceStats.missed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Adherence Chart */}
      <Card ref={chartRef}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Kepatuhan Harian
          </CardTitle>
          <CardDescription>Breakdown status per hari</CardDescription>
        </CardHeader>
        <CardContent>
          {!chartInView ? (
            <Skeleton className="h-48 w-full rounded" />
          ) : !hasChartData ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Belum ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={dateTickFormatter}
                  className="text-xs"
                />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip
                  labelFormatter={dateLabelFormatter}
                  contentStyle={tooltipStyle}
                />
                <Legend />
                <Bar
                  dataKey="Tepat Waktu"
                  stackId="a"
                  fill={STATUS_COLORS.onTime}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Terlambat"
                  stackId="a"
                  fill={STATUS_COLORS.late}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Terlewat"
                  stackId="a"
                  fill={STATUS_COLORS.missed}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tips based on adherence */}
      {adherenceStats.missed > 0 && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              Tips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Anda melewatkan {adherenceStats.missed} sesi dalam {days} hari
              terakhir. Coba aktifkan notifikasi untuk pengingat jadwal pumping.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdherenceStatsSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-4 w-24 mt-1" />
            </div>
            <div className="text-right">
              <Skeleton className="h-7 w-12 ml-auto" />
              <Skeleton className="h-4 w-20 mt-1 ml-auto" />
            </div>
          </div>
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-1 pt-3 px-3">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <Skeleton className="h-8 w-8" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
