import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
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
import { Download } from "lucide-react";
import { HistoryListSkeleton } from "@/components/skeletons";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ExportDialog } from "@/components/ExportDialog";
import { SwipeableSessionCard } from "@/components/SwipeableSessionCard";
import type { SessionExport, SummaryStatsExport } from "@/lib/export";

export const Route = createFileRoute("/history")({
  component: History,
});

type DateFilter = "today" | "week" | "month" | "all";

// Threshold for enabling virtual scrolling (to avoid overhead for small lists)
const VIRTUAL_SCROLL_THRESHOLD = 50;

// Row types for virtualized list
type VirtualRow =
  | { type: "date-header"; date: string }
  | { type: "session"; session: SessionData };

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

// formatDuration moved to SwipeableSessionCard component

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

  // Memoized: Convert sessions for export
  const exportableSessions = useMemo((): SessionExport[] => {
    if (!sessions) return [];
    return sessions.map((s) => ({
      _id: s._id,
      sessionType: s.sessionType,
      startTime: s.startTime,
      endTime: s.endTime,
      volume: s.volume,
      totalPumpDuration: s.totalPumpDuration,
      totalRestDuration: s.totalRestDuration,
      notes: s.notes,
      latenessMinutes: s.latenessMinutes,
      isCompleted: s.isCompleted,
    }));
  }, [sessions]);

  // Memoized: Summary for export
  const exportSummary = useMemo((): SummaryStatsExport | undefined => {
    if (!sessions || sessions.length === 0) return undefined;

    const regularSessions = sessions.filter((s) => s.sessionType === "regular");
    const powerSessions = sessions.filter((s) => s.sessionType === "power");
    const regularVolume = regularSessions.reduce((sum, s) => sum + (s.volume || 0), 0);
    const powerVolume = powerSessions.reduce((sum, s) => sum + (s.volume || 0), 0);

    // Group by day for avgVolumePerDay
    const dailyVolumes = new Map<string, number>();
    for (const session of sessions) {
      const dateStr = format(new Date(session.startTime), "yyyy-MM-dd");
      dailyVolumes.set(dateStr, (dailyVolumes.get(dateStr) || 0) + (session.volume || 0));
    }

    // Find best session and best day
    let bestSession = sessions[0];
    let bestDay: { date: string; volume: number } | null = null;

    for (const s of sessions) {
      if ((s.volume || 0) > (bestSession.volume || 0)) {
        bestSession = s;
      }
    }

    for (const [date, volume] of dailyVolumes) {
      if (!bestDay || volume > bestDay.volume) {
        bestDay = { date, volume };
      }
    }

    return {
      totalSessions,
      totalVolume,
      avgVolumePerSession: totalSessions > 0 ? Math.round(totalVolume / totalSessions) : 0,
      avgVolumePerDay: dailyVolumes.size > 0 ? Math.round(totalVolume / dailyVolumes.size) : 0,
      bestSession: bestSession ? {
        volume: bestSession.volume || 0,
        date: bestSession.startTime,
        sessionType: bestSession.sessionType,
      } : null,
      bestDay,
      regularStats: {
        count: regularSessions.length,
        totalVolume: regularVolume,
        avgVolume: regularSessions.length > 0 ? Math.round(regularVolume / regularSessions.length) : 0,
      },
      powerStats: {
        count: powerSessions.length,
        totalVolume: powerVolume,
        avgVolume: powerSessions.length > 0 ? Math.round(powerVolume / powerSessions.length) : 0,
      },
    };
  }, [sessions, totalSessions, totalVolume]);

  // Get period label for export
  const periodLabel = useMemo(() => {
    switch (filter) {
      case "today":
        return "Hari Ini";
      case "week":
        return "Minggu Ini";
      case "month":
        return "Bulan Ini";
      default:
        return "Semua Sesi";
    }
  }, [filter]);

  // Get date range for export
  const exportDateRange = useMemo(() => {
    if (filter === "all" || !sessions || sessions.length === 0) return undefined;
    return {
      start: new Date(dateRange.start),
      end: new Date(dateRange.end),
    };
  }, [filter, dateRange, sessions]);

  // Memoized: Flattened rows for virtualization
  const virtualRows = useMemo((): VirtualRow[] => {
    const rows: VirtualRow[] = [];
    for (const date of sortedDates) {
      rows.push({ type: "date-header", date });
      for (const session of groupedSessions[date] || []) {
        rows.push({ type: "session", session: session as SessionData });
      }
    }
    return rows;
  }, [sortedDates, groupedSessions]);

  // Determine if we should use virtual scrolling
  const useVirtualScrolling = totalSessions >= VIRTUAL_SCROLL_THRESHOLD;

  return (
    <div className="p-4 space-y-4 print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Riwayat</h1>
          <p className="text-muted-foreground">Lihat sesi sebelumnya</p>
        </div>
        {sessions && sessions.length > 0 && (
          <ExportDialog
            sessions={exportableSessions}
            summary={exportSummary}
            dateRange={exportDateRange}
            periodLabel={periodLabel}
            trigger={
              <Button variant="outline" size="sm" className="print:hidden">
                <Download className="h-4 w-4 mr-2" />
                Ekspor
              </Button>
            }
          />
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 print:hidden">
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

      {/* Print Header - only visible when printing */}
      <div className="hidden print:block print:mb-4">
        <h2 className="text-lg font-semibold">Laporan Sesi Pumping - {periodLabel}</h2>
        <p className="text-sm text-muted-foreground">
          Dicetak: {format(new Date(), "d MMMM yyyy, HH:mm")}
        </p>
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
      ) : useVirtualScrolling ? (
        <VirtualizedSessionList
          rows={virtualRows}
          selectedSession={selectedSession}
          onToggle={handleToggle}
          onCollapse={handleCollapse}
          onDelete={handleDelete}
        />
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {format(new Date(date), "EEEE, MMMM d, yyyy")}
              </h3>
              <div className="space-y-2">
                {groupedSessions[date]?.map((session) => (
                  <SwipeableSessionCard
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

// Virtualized session list component for large datasets
interface VirtualizedSessionListProps {
  rows: VirtualRow[];
  selectedSession: string | null;
  onToggle: (id: string) => void;
  onCollapse: () => void;
  onDelete: (id: string) => Promise<void>;
}

const VirtualizedSessionList = memo(function VirtualizedSessionList({
  rows,
  selectedSession,
  onToggle,
  onCollapse,
  onDelete,
}: VirtualizedSessionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Dynamic row height estimation
  const getRowHeight = useCallback(
    (index: number) => {
      const row = rows[index];
      if (row.type === "date-header") {
        return 40; // Date header height
      }
      // Session card: collapsed ~88px, expanded ~400px
      if (selectedSession === row.session._id) {
        return 400;
      }
      return 88;
    },
    [rows, selectedSession]
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 5,
    getItemKey: (index) => {
      const row = rows[index];
      return row.type === "date-header" ? `date-${row.date}` : row.session._id;
    },
  });

  // Re-measure when selection changes
  useEffect(() => {
    virtualizer.measure();
  }, [selectedSession, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-340px)] overflow-auto"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === "date-header" ? (
                <h3 className="text-sm font-medium text-muted-foreground py-2 sticky top-0 bg-background z-10">
                  {format(new Date(row.date), "EEEE, MMMM d, yyyy")}
                </h3>
              ) : (
                <div className="pb-2">
                  <SwipeableSessionCard
                    session={row.session}
                    isExpanded={selectedSession === row.session._id}
                    onToggle={onToggle}
                    onCollapse={onCollapse}
                    onDelete={onDelete}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// SessionCard moved to SwipeableSessionCard component
