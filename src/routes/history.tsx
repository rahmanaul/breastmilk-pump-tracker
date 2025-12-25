import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Clock, Zap, Trash2, AlertCircle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoryListSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/history")({
  component: History,
});

type DateFilter = "today" | "week" | "month" | "all";

function getDateRange(filter: DateFilter): { start: number; end: number } {
  const now = new Date();

  switch (filter) {
    case "today":
      return {
        start: startOfDay(now).getTime(),
        end: endOfDay(now).getTime(),
      };
    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
        end: endOfWeek(now, { weekStartsOn: 1 }).getTime(),
      };
    case "month":
      return {
        start: startOfMonth(now).getTime(),
        end: endOfMonth(now).getTime(),
      };
    case "all":
    default:
      return {
        start: 0,
        end: Date.now() + 86400000, // tomorrow
      };
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

function History() {
  const [filter, setFilter] = useState<DateFilter>("week");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // Memoize dateRange to prevent infinite re-renders when filter is "all"
  // The "all" filter uses Date.now() which changes every render
  const dateRange = useMemo(() => getDateRange(filter), [filter]);

  const sessions = useQuery(api.sessions.getByDateRange, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const deleteSession = useMutation(api.sessions.remove);

  // Stable callbacks to prevent re-renders
  const handleToggle = useCallback((id: string) => {
    setSelectedSession(id);
  }, []);

  const handleCollapse = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const handleDelete = useCallback(async (sessionId: string) => {
    if (confirm("Yakin ingin menghapus sesi ini?")) {
      try {
        await deleteSession({ sessionId: sessionId as any });
        toast.success("Sesi berhasil dihapus");
        setSelectedSession(null);
      } catch (error) {
        console.error("Failed to delete session:", error);
        toast.error("Gagal menghapus sesi", {
          description: "Silakan coba lagi",
        });
      }
    }
  }, [deleteSession]);

  // Memoized: Group sessions by date
  const groupedSessions = useMemo(() => {
    if (!sessions) return {};
    return sessions.reduce(
      (groups, session) => {
        const date = format(new Date(session.startTime), "yyyy-MM-dd");
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(session);
        return groups;
      },
      {} as Record<string, typeof sessions>
    );
  }, [sessions]);

  // Memoized: Sorted dates
  const sortedDates = useMemo(() => {
    return Object.keys(groupedSessions).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [groupedSessions]);

  // Memoized: Calculate totals
  const { totalVolume, totalSessions } = useMemo(() => {
    return {
      totalVolume: sessions?.reduce((sum, s) => sum + (s.volume || 0), 0) || 0,
      totalSessions: sessions?.length || 0,
    };
  }, [sessions]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Riwayat</h1>
        <p className="text-muted-foreground">Lihat sesi sebelumnya</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "today"
              ? "Hari Ini"
              : f === "week"
                ? "Minggu"
                : f === "month"
                  ? "Bulan"
                  : "Semua"}
          </Button>
        ))}
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="py-3">
          <div className="flex justify-between text-center">
            <div>
              <p className="text-sm text-muted-foreground">Sesi</p>
              <p className="text-xl font-semibold">{totalSessions}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Volume</p>
              <p className="text-xl font-semibold">{totalVolume} ml</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rata-rata</p>
              <p className="text-xl font-semibold">
                {totalSessions > 0 ? Math.round(totalVolume / totalSessions) : 0} ml
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {sessions === undefined ? (
        <HistoryListSkeleton count={5} />
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Tidak ada sesi</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {format(new Date(date), "EEEE, MMMM d, yyyy")}
              </h3>
              <div className="space-y-2">
                {groupedSessions[date]?.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session as SessionData}
                    isExpanded={selectedSession === session._id}
                    onToggle={handleToggle}
                    onCollapse={handleCollapse}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Session type for props
type SessionData = {
  _id: string;
  sessionType: "regular" | "power";
  startTime: number;
  endTime?: number;
  volume?: number;
  totalPumpDuration?: number;
  totalRestDuration?: number;
  notes?: string;
  intervals: Array<{
    type: "pump" | "rest";
    startTime: number;
    endTime?: number;
  }>;
  latenessMinutes?: number;
  isCompleted?: boolean;
  scheduledTime?: number;
};

interface SessionCardProps {
  session: SessionData;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onCollapse: () => void;
  onDelete: (id: string) => Promise<void>;
}

// Memoized SessionCard component to prevent unnecessary re-renders
const SessionCard = memo(function SessionCard({
  session,
  isExpanded,
  onToggle,
  onCollapse,
  onDelete,
}: SessionCardProps) {
  const isRegular = session.sessionType === "regular";
  const isLate = session.latenessMinutes !== undefined && session.latenessMinutes > 0;
  const isCompleted = session.isCompleted ?? true;

  // Memoized toggle handler - uses stable callbacks
  const handleToggle = useCallback(() => {
    if (isExpanded) {
      onCollapse();
    } else {
      onToggle(session._id);
    }
  }, [isExpanded, onToggle, onCollapse, session._id]);

  // Memoized delete handler
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void onDelete(session._id);
    },
    [onDelete, session._id]
  );

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors",
        isExpanded && "ring-2 ring-primary"
      )}
      onClick={handleToggle}
    >
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                isRegular
                  ? "bg-blue-100 dark:bg-blue-900"
                  : "bg-amber-100 dark:bg-amber-900"
              )}
            >
              {isRegular ? (
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium capitalize">{session.sessionType}</p>
                {/* Lateness indicator */}
                {isLate && (
                  <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                    <AlertCircle className="h-3 w-3" />
                    {session.latenessMinutes}m
                  </span>
                )}
                {/* Completion status */}
                {isCompleted ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-600" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(session.startTime), "h:mm a")}
                {session.endTime &&
                  ` - ${format(new Date(session.endTime), "h:mm a")}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{session.volume || 0} ml</p>
            <p className="text-sm text-muted-foreground">
              {formatDuration(session.totalPumpDuration || 0)} pump
            </p>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {/* Lateness and Completion Status */}
            <div className="flex gap-4 text-sm">
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded",
                  isLate
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                )}
              >
                {isLate ? (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Telat {session.latenessMinutes} menit
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3" />
                    Tepat waktu
                  </>
                )}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded",
                  isCompleted
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                )}
              >
                {isCompleted ? (
                  <>
                    <Check className="h-3 w-3" />
                    Tuntas
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    Tidak tuntas
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Waktu Pump</p>
                <p className="font-medium">
                  {formatDuration(session.totalPumpDuration || 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Waktu Istirahat</p>
                <p className="font-medium">
                  {formatDuration(session.totalRestDuration || 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Interval</p>
                <p className="font-medium">{session.intervals.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Waktu</p>
                <p className="font-medium">
                  {formatDuration(
                    (session.totalPumpDuration || 0) +
                      (session.totalRestDuration || 0)
                  )}
                </p>
              </div>
            </div>

            {session.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Catatan</p>
                <p className="font-medium">{session.notes}</p>
              </div>
            )}

            {/* Interval Timeline */}
            <div className="text-sm">
              <p className="text-muted-foreground mb-2">Interval</p>
              <div className="flex gap-1 flex-wrap">
                {session.intervals.map((interval, idx) => {
                  const duration = interval.endTime
                    ? Math.round((interval.endTime - interval.startTime) / 1000)
                    : 0;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "px-2 py-1 rounded text-xs",
                        interval.type === "pump"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      )}
                    >
                      {interval.type === "pump" ? "P" : "R"}: {formatDuration(duration)}
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus Sesi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
