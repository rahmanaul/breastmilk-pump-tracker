import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState, useEffect, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Droplets,
  Clock,
  Check,
  Circle,
  ArrowRight,
  AlertCircle,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatScheduleTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

function Dashboard() {
  const scheduleStatus = useQuery(api.sessions.getTodayScheduleStatus);
  const todaySessions = useQuery(api.sessions.getToday);

  const totalVolume = todaySessions?.reduce((sum, s) => sum + (s.volume || 0), 0) || 0;
  const totalPumpTime = todaySessions?.reduce((sum, s) => sum + (s.totalPumpDuration || 0), 0) || 0;

  // Calculate progress
  const completedCount = scheduleStatus?.filter(
    (s) => s.status === "completed" || s.status === "late"
  ).length || 0;
  const totalScheduled = scheduleStatus?.length || 0;
  const progressPercent = totalScheduled > 0 ? (completedCount / totalScheduled) * 100 : 0;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hari Ini</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <Link to="/session">
          <Button size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Sesi Baru
          </Button>
        </Link>
      </div>

      {/* Progress Card */}
      {totalScheduled > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress Hari Ini</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalScheduled} sesi
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Schedule Section - Main Focus */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Jadwal Hari Ini</h2>
        {scheduleStatus === undefined ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : scheduleStatus.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-2">Belum ada jadwal</p>
              <Link to="/settings">
                <Button variant="link">Atur jadwal di Settings</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {scheduleStatus.map((item) => (
              <ScheduleCard key={item.scheduleSlotId} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Droplets className="h-4 w-4" />
              <span className="text-xs">Total Volume</span>
            </div>
            <p className="text-2xl font-bold">{totalVolume} ml</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Waktu Pump</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(totalPumpTime)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Schedule status type from backend
type ScheduleStatusItem = {
  scheduleSlotId: string;
  time: string;
  scheduledTimestamp: number;
  sessionType: "regular" | "power";
  status: "pending" | "in_progress" | "completed" | "late" | "missed";
  session?: {
    volume?: number;
    totalPumpDuration?: number;
  };
  latenessMinutes?: number;
  isCompleted?: boolean;
};

function ScheduleCard({ item }: { item: ScheduleStatusItem }) {
  const navigate = useNavigate();
  const isRegular = item.sessionType === "regular";

  // Use state + effect to calculate time-based values
  const [isNext, setIsNext] = useState(false);

  useEffect(() => {
    const checkIsNext = () => {
      const now = Date.now();
      setIsNext(
        item.status === "pending" &&
          item.scheduledTimestamp <= now + 30 * 60 * 1000 // within 30 min
      );
    };
    checkIsNext();
    // Check every minute for time-based updates
    const interval = setInterval(checkIsNext, 60000);
    return () => clearInterval(interval);
  }, [item.status, item.scheduledTimestamp]);

  const handleStartSession = useCallback(() => {
    void navigate({
      to: "/session",
      search: {
        scheduleSlotId: item.scheduleSlotId,
        scheduledTime: item.scheduledTimestamp.toString(),
        sessionType: item.sessionType,
      },
    });
  }, [navigate, item.scheduleSlotId, item.scheduledTimestamp, item.sessionType]);

  // Status styling
  const getStatusStyles = () => {
    switch (item.status) {
      case "completed":
        return {
          bg: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
          icon: <Check className="h-4 w-4 text-green-600" />,
          iconBg: "bg-green-100 dark:bg-green-900",
        };
      case "late":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
          icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
          iconBg: "bg-yellow-100 dark:bg-yellow-900",
        };
      case "missed":
        return {
          bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
          icon: <X className="h-4 w-4 text-red-600" />,
          iconBg: "bg-red-100 dark:bg-red-900",
        };
      case "in_progress":
        return {
          bg: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
          icon: <ArrowRight className="h-4 w-4 text-blue-600 animate-pulse" />,
          iconBg: "bg-blue-100 dark:bg-blue-900",
        };
      default: // pending
        return {
          bg: isNext
            ? "bg-primary/5 border-primary/30"
            : "bg-muted/30 border-muted",
          icon: isNext ? (
            <ArrowRight className="h-4 w-4 text-primary" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          ),
          iconBg: isNext ? "bg-primary/10" : "bg-muted",
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <Card className={cn("border", styles.bg)}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
              styles.iconBg
            )}
          >
            {styles.icon}
          </div>

          {/* Time and Type */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatScheduleTime(item.time)}</span>
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  isRegular
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                )}
              >
                {isRegular ? "Regular" : "Power"}
              </span>
            </div>

            {/* Status Text */}
            <div className="text-xs text-muted-foreground mt-0.5">
              {item.status === "completed" && (
                <span className="text-green-600">
                  Tepat waktu {item.isCompleted ? "- Tuntas" : "- Tidak tuntas"}
                </span>
              )}
              {item.status === "late" && (
                <span className="text-yellow-600">
                  Telat {item.latenessMinutes} menit{" "}
                  {item.isCompleted ? "- Tuntas" : "- Tidak tuntas"}
                </span>
              )}
              {item.status === "missed" && (
                <span className="text-red-600">Terlewat</span>
              )}
              {item.status === "in_progress" && (
                <span className="text-blue-600">Sedang berlangsung</span>
              )}
              {item.status === "pending" && isNext && (
                <span className="text-primary">Selanjutnya</span>
              )}
              {item.status === "pending" && !isNext && (
                <span>Akan datang</span>
              )}
            </div>
          </div>

          {/* Right side - Volume or Start button */}
          {(item.status === "completed" || item.status === "late") &&
          item.session?.volume !== undefined ? (
            <div className="text-right">
              <p className="font-semibold">{item.session.volume} ml</p>
              {item.session.totalPumpDuration && (
                <p className="text-xs text-muted-foreground">
                  {formatDuration(item.session.totalPumpDuration)}
                </p>
              )}
            </div>
          ) : item.status === "pending" || item.status === "missed" ? (
            <Button
              size="sm"
              variant={isNext ? "default" : "outline"}
              onClick={handleStartSession}
              className="shrink-0"
            >
              Mulai
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
