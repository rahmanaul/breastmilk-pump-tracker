import { memo, useCallback, useState, useRef } from "react";
import { useSwipeable } from "react-swipeable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Zap, Trash2, AlertCircle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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

interface SwipeableSessionCardProps {
  session: SessionData;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onCollapse: () => void;
  onDelete: (id: string) => Promise<void>;
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

// Memoized SwipeableSessionCard component
export const SwipeableSessionCard = memo(function SwipeableSessionCard({
  session,
  isExpanded,
  onToggle,
  onCollapse,
  onDelete,
}: SwipeableSessionCardProps) {
  const isRegular = session.sessionType === "regular";
  const isLate = session.latenessMinutes !== undefined && session.latenessMinutes > 0;
  const isCompleted = session.isCompleted ?? true;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = 80; // Pixels to trigger delete action

  const handlers = useSwipeable({
    onSwiping: (e) => {
      // Only allow left swipe
      if (e.dir === "Left") {
        const offset = Math.min(Math.abs(e.deltaX), DELETE_THRESHOLD + 20);
        setSwipeOffset(-offset);
      }
    },
    onSwipedLeft: (e) => {
      if (Math.abs(e.deltaX) >= DELETE_THRESHOLD) {
        // Show delete state briefly, then trigger delete
        setIsDeleting(true);
        void handleSwipeDelete();
      } else {
        // Reset if didn't swipe enough
        setSwipeOffset(0);
      }
    },
    onSwiped: () => {
      // Reset on any swipe end if not deleting
      if (!isDeleting) {
        setSwipeOffset(0);
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
    delta: 10,
  });

  const handleSwipeDelete = async () => {
    // Confirm deletion
    if (confirm("Yakin ingin menghapus sesi ini?")) {
      await onDelete(session._id);
    } else {
      setIsDeleting(false);
      setSwipeOffset(0);
    }
  };

  // Memoized toggle handler
  const handleToggle = useCallback(() => {
    if (swipeOffset !== 0) {
      setSwipeOffset(0);
      return;
    }
    if (isExpanded) {
      onCollapse();
    } else {
      onToggle(session._id);
    }
  }, [isExpanded, onToggle, onCollapse, session._id, swipeOffset]);

  // Memoized delete handler (for button click)
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void onDelete(session._id);
    },
    [onDelete, session._id]
  );

  return (
    <div className="relative overflow-hidden rounded-lg" {...handlers}>
      {/* Delete background */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end bg-destructive transition-opacity",
          swipeOffset < 0 || isDeleting ? "opacity-100" : "opacity-0"
        )}
        style={{ width: DELETE_THRESHOLD + 20 }}
      >
        <div className="flex items-center gap-2 pr-4 text-destructive-foreground">
          <Trash2 className="h-5 w-5" />
          <span className="text-sm font-medium">Hapus</span>
        </div>
      </div>

      {/* Swipeable card */}
      <div
        ref={cardRef}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
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
                    {isLate && (
                      <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                        <AlertCircle className="h-3 w-3" />
                        {session.latenessMinutes}m
                      </span>
                    )}
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
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus Sesi
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Swipe hint indicator */}
      {!isExpanded && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs hidden md:hidden">
          {/* Hidden on mobile - swipe hint is visual enough */}
        </div>
      )}
    </div>
  );
});
