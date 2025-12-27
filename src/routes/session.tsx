import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useMutationWithRetry } from "@/hooks/useMutationWithRetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useTimer, type ResumeState, type TimerInterval, type CustomInterval } from "@/hooks/useTimer";
import { useAudioAlert } from "@/hooks/useAudioAlert";
import { IntervalBuilder, simpleToIntervals } from "@/components/IntervalBuilder";
import { Square, RefreshCw, Zap, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

// Search params type for route
type SessionSearchParams = {
  scheduleSlotId?: string;
  scheduledTime?: string;
  sessionType?: "regular" | "power";
  resume?: string; // Session ID to resume
};

export const Route = createFileRoute("/session")({
  component: Session,
  validateSearch: (search: Record<string, unknown>): SessionSearchParams => {
    return {
      scheduleSlotId: search.scheduleSlotId as string | undefined,
      scheduledTime: search.scheduledTime as string | undefined,
      sessionType: search.sessionType as "regular" | "power" | undefined,
      resume: search.resume as string | undefined,
    };
  },
});

type SessionType = "regular" | "power";
type SessionPhase = "config" | "timer" | "complete";
type ConfigMode = "simple" | "custom";

interface TimerConfig {
  mode: ConfigMode;
  intervals: CustomInterval[]; // The actual interval sequence
  // Simple mode reference values
  pumpDuration?: number; // seconds
  restDuration?: number; // seconds
  pumpCount?: number; // number of pump phases
}

// Helper function to calculate resume state from session intervals
function calculateResumeState(
  intervals: Array<{ type: "pump" | "rest"; startTime: number; endTime?: number }>
): ResumeState {
  const now = Date.now();

  // Convert intervals to TimerInterval format and find the open one
  const completedIntervals: TimerInterval[] = [];
  let currentIntervalIndex = 0;
  let elapsedInCurrentInterval = 0;

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    if (interval.endTime) {
      // Completed interval
      completedIntervals.push({
        type: interval.type,
        startTime: interval.startTime,
        endTime: interval.endTime,
        duration: Math.floor((interval.endTime - interval.startTime) / 1000),
      });
    } else {
      // Open interval (current one)
      currentIntervalIndex = i;
      elapsedInCurrentInterval = Math.floor((now - interval.startTime) / 1000);
    }
  }

  return {
    currentIntervalIndex,
    elapsedInCurrentInterval,
    completedIntervals,
  };
}

function Session() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/session" });

  const defaults = useQuery(api.preferences.getDefaults);

  // Query for current active session (for automatic resume detection)
  const currentSession = useQuery(api.sessions.getCurrent);

  // Query for existing session if resuming
  const existingSession = useQuery(
    api.sessions.getById,
    search.resume ? { sessionId: search.resume as Id<"pumpingSessions"> } : "skip"
  );

  const { mutate: startSession } = useMutationWithRetry(api.sessions.start, {
    errorMessage: "Gagal memulai sesi",
    retryMessage: "Mencoba memulai sesi...",
  });
  const { mutate: switchIntervalMutation } = useMutationWithRetry(
    api.sessions.switchInterval,
    {
      errorMessage: "Gagal mengubah interval",
      maxRetries: 1, // Quick retry for interval switching
    }
  );
  const { mutate: completeSession, state: completeState } = useMutationWithRetry(
    api.sessions.complete,
    {
      errorMessage: "Gagal menyimpan sesi",
      retryMessage: "Mencoba menyimpan sesi...",
    }
  );
  const { mutate: cancelCurrentSession } = useMutationWithRetry(
    api.sessions.cancelCurrent,
    {
      errorMessage: "Gagal membatalkan sesi",
    }
  );

  const [phase, setPhase] = useState<SessionPhase>("config");
  const [sessionType, setSessionType] = useState<SessionType>(
    search.sessionType || "regular"
  );
  const [timerConfig, setTimerConfig] = useState<TimerConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [volume, setVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [isCompleted, setIsCompleted] = useState(true); // tuntas
  const [finalPumpSeconds, setFinalPumpSeconds] = useState(0);
  const [finalRestSeconds, setFinalRestSeconds] = useState(0);
  const [hasResumed, setHasResumed] = useState(false);

  // Schedule info from search params
  const scheduleInfo = search.scheduleSlotId
    ? {
        slotId: search.scheduleSlotId,
        scheduledTime: search.scheduledTime ? parseInt(search.scheduledTime) : undefined,
      }
    : null;

  const audioAlert = useAudioAlert();

  const timer = useTimer({
    intervals: timerConfig?.intervals,
    pumpDuration: timerConfig?.pumpDuration ?? 900,
    restDuration: timerConfig?.restDuration ?? 300,
    totalPumps: timerConfig?.pumpCount ?? 1,
    onAlarmTrigger: () => {
      const message = timer.currentIntervalType === "pump"
        ? `Pumping selesai! (Pump ${timer.currentPump} dari ${timer.totalPumps})`
        : `Istirahat selesai! Lanjut ke Pump ${timer.currentPump + 1}`;

      // Play alarm with error handling
      audioAlert.play(message).catch((err) => {
        console.error("Failed to play alarm:", err);
        toast.error("Alarm gagal berbunyi", {
          description: "Periksa pengaturan notifikasi browser Anda",
        });
      });
    },
    onAllCyclesComplete: () => {
      // Auto-stop when all pumps complete
      audioAlert.stop();
    },
  });


  // Handle resuming an existing session
  useEffect(() => {
    if (search.resume && existingSession && !hasResumed && existingSession.status === "in_progress") {
      // Set up session state from existing session
      setSessionId(existingSession._id);
      setSessionType(existingSession.sessionType);

      // Set timer config from saved config or use defaults
      let config: TimerConfig;
      const savedConfig = existingSession.timerConfig;

      if (savedConfig && "intervals" in savedConfig && savedConfig.intervals) {
        // New format with intervals array
        config = {
          mode: savedConfig.mode || "simple",
          intervals: savedConfig.intervals,
          pumpDuration: savedConfig.pumpDuration,
          restDuration: savedConfig.restDuration,
          pumpCount: savedConfig.cycles,
        };
      } else if (savedConfig) {
        // Legacy format - convert to intervals
        const pumpDuration = savedConfig.pumpDuration ?? defaults?.pumpDuration ?? 900;
        const restDuration = savedConfig.restDuration ?? defaults?.restDuration ?? 300;
        const cycles = savedConfig.cycles ?? defaults?.cycles ?? 1;
        config = {
          mode: "simple",
          intervals: simpleToIntervals(pumpDuration / 60, restDuration / 60, cycles),
          pumpDuration,
          restDuration,
          pumpCount: cycles,
        };
      } else {
        // No config - use defaults
        const pumpDuration = defaults?.pumpDuration ?? 900;
        const restDuration = defaults?.restDuration ?? 300;
        const cycles = defaults?.cycles ?? 1;
        config = {
          mode: "simple",
          intervals: simpleToIntervals(pumpDuration / 60, restDuration / 60, cycles),
          pumpDuration,
          restDuration,
          pumpCount: cycles,
        };
      }
      setTimerConfig(config);

      // Calculate and set resume state
      const resumeState = calculateResumeState(existingSession.intervals);

      // Go directly to timer phase and resume
      setPhase("timer");
      setHasResumed(true);

      // Resume timer with calculated state (slight delay to ensure config is set)
      setTimeout(() => {
        timer.resumeFromState(resumeState);
      }, 100);
    }
  }, [search.resume, existingSession, hasResumed, defaults, timer]);

  // Stop alarm when dismissed
  useEffect(() => {
    if (!timer.isAlarmTriggered && audioAlert.isPlaying) {
      audioAlert.stop();
    }
  }, [timer.isAlarmTriggered, audioAlert]);

  const handleStartTimer = async (config: TimerConfig) => {
    // Request notification permission before starting timer
    const permissionGranted = await audioAlert.requestPermissions();
    if (!permissionGranted) {
      toast.info("Izin notifikasi diperlukan", {
        description: "Untuk alarm yang lebih baik, aktifkan notifikasi di pengaturan browser",
      });
    }

    setTimerConfig(config);

    // Build timer config for backend - include intervals for new format
    const backendConfig = {
      mode: config.mode,
      intervals: config.intervals.map(i => ({
        id: i.id,
        type: i.type,
        duration: i.duration,
      })),
      pumpDuration: config.pumpDuration,
      restDuration: config.restDuration,
      cycles: config.pumpCount,
    };

    const id = await startSession({
      sessionType,
      scheduleSlotId: scheduleInfo?.slotId,
      scheduledTime: scheduleInfo?.scheduledTime,
      timerConfig: backendConfig,
    });

    if (id) {
      setSessionId(id);
      // Timer will start after state update, use effect
      setPhase("timer");
    }
  };

  // Start timer when entering timer phase
  useEffect(() => {
    if (phase === "timer" && timerConfig && !timer.isRunning) {
      timer.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timerConfig]);

  const handleSwitchInterval = async () => {
    audioAlert.stop();
    timer.dismissAlarm();
    timer.switchInterval();

    if (sessionId) {
      const newType = timer.currentIntervalType === "pump" ? "rest" : "pump";
      await switchIntervalMutation({
        sessionId: sessionId as any,
        newIntervalType: newType,
      });
    }
  };

  const handleStopSession = () => {
    audioAlert.stop();
    const result = timer.stop();
    setFinalPumpSeconds(result.totalPumpSeconds);
    setFinalRestSeconds(result.totalRestSeconds);
    setPhase("complete");
  };

  const handleCompleteSession = useCallback(async () => {
    if (!sessionId || !volume) return;

    const result = await completeSession({
      sessionId: sessionId as any,
      volume: parseFloat(volume),
      notes: notes || undefined,
      isCompleted,
    });

    if (result !== undefined) {
      toast.success("Sesi berhasil disimpan", {
        description: `Volume: ${volume} ml`,
      });
      void navigate({ to: "/" });
    }
  }, [sessionId, volume, notes, isCompleted, completeSession, navigate]);

  const handleCancelAndStartNew = async () => {
    await cancelCurrentSession({});
    toast.success("Sesi sebelumnya dibatalkan");
    // The page will re-render and allow starting new session
  };

  // Show loading while fetching defaults, current session, or existing session
  if (!defaults || currentSession === undefined || (search.resume && existingSession === undefined)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">
          {search.resume || currentSession ? "Melanjutkan sesi..." : "Loading..."}
        </p>
      </div>
    );
  }

  // If trying to resume but session not found or already completed
  if (search.resume && (!existingSession || existingSession.status !== "in_progress")) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Sesi tidak ditemukan atau sudah selesai</p>
          <Button onClick={() => void navigate({ to: "/" })}>Kembali ke Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {phase === "config" && (
        <SessionConfig
          sessionType={sessionType}
          onSessionTypeChange={setSessionType}
          scheduleInfo={scheduleInfo}
          defaults={defaults}
          onStart={(config) => void handleStartTimer(config)}
          isFromSchedule={!!scheduleInfo}
          currentSession={currentSession}
          onResumeSession={() => void navigate({ to: "/session", search: { resume: currentSession!._id } })}
          onCancelAndStartNew={() => void handleCancelAndStartNew()}
        />
      )}

      {phase === "timer" && timerConfig && (
        <>
          <TimerDisplay
            timer={timer}
            sessionType={sessionType}
            onSwitch={() => void handleSwitchInterval()}
            onStop={handleStopSession}
          />

          {/* Alarm Overlay */}
          {timer.isAlarmTriggered && !timer.isSessionComplete && (
            <AlarmOverlay
              intervalType={timer.currentIntervalType}
              currentPump={timer.currentPump}
              totalPumps={timer.totalPumps}
              onDismiss={() => void handleSwitchInterval()}
            />
          )}

          {/* Session Complete Overlay */}
          {timer.isSessionComplete && (
            <SessionCompleteOverlay onFinish={handleStopSession} />
          )}
        </>
      )}

      {phase === "complete" && (
        <SessionComplete
          sessionType={sessionType}
          totalPumpSeconds={finalPumpSeconds}
          totalRestSeconds={finalRestSeconds}
          volume={volume}
          notes={notes}
          isCompleted={isCompleted}
          onVolumeChange={setVolume}
          onNotesChange={setNotes}
          onIsCompletedChange={setIsCompleted}
          onSubmit={() => void handleCompleteSession()}
          isSubmitting={completeState.isLoading}
        />
      )}
    </div>
  );
}

// Session configuration screen with Simple/Custom mode toggle
function SessionConfig({
  sessionType,
  onSessionTypeChange,
  scheduleInfo: _scheduleInfo,
  defaults,
  onStart,
  isFromSchedule,
  currentSession,
  onResumeSession,
  onCancelAndStartNew,
}: {
  sessionType: SessionType;
  onSessionTypeChange: (type: SessionType) => void;
  scheduleInfo: { slotId: string; scheduledTime?: number } | null;
  defaults: { pumpDuration: number; restDuration: number; cycles: number };
  onStart: (config: TimerConfig) => void;
  isFromSchedule: boolean;
  currentSession: any; // Active session if exists
  onResumeSession: () => void;
  onCancelAndStartNew: () => void;
}) {
  // Mode state
  const [mode, setMode] = useState<ConfigMode>("simple");

  // Simple mode state
  const [pumpMinutes, setPumpMinutes] = useState(Math.floor(defaults.pumpDuration / 60));
  const [restMinutes, setRestMinutes] = useState(Math.floor(defaults.restDuration / 60));
  const [pumpCount, setPumpCount] = useState(defaults.cycles);

  // Custom mode state - initialize from simple mode values
  const [customIntervals, setCustomIntervals] = useState<CustomInterval[]>(() =>
    simpleToIntervals(Math.floor(defaults.pumpDuration / 60), Math.floor(defaults.restDuration / 60), defaults.cycles)
  );

  // Calculate total minutes for simple mode
  const simpleTotalMinutes = pumpCount * pumpMinutes + (pumpCount - 1) * restMinutes;

  // Calculate total minutes for custom mode
  const customTotalMinutes = customIntervals.reduce((sum, i) => sum + i.duration / 60, 0);

  // When switching to custom mode, sync intervals from simple mode
  const handleModeChange = (newMode: ConfigMode) => {
    if (newMode === "custom" && mode === "simple") {
      // Generate intervals from current simple mode settings
      setCustomIntervals(simpleToIntervals(pumpMinutes, restMinutes, pumpCount));
    }
    setMode(newMode);
  };

  const handleStart = () => {
    if (mode === "simple") {
      const intervals = simpleToIntervals(pumpMinutes, restMinutes, pumpCount);
      onStart({
        mode: "simple",
        intervals,
        pumpDuration: pumpMinutes * 60,
        restDuration: restMinutes * 60,
        pumpCount,
      });
    } else {
      onStart({
        mode: "custom",
        intervals: customIntervals,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Pengaturan Sesi</h1>
        <p className="text-muted-foreground mt-2">
          Atur durasi pumping dan istirahat
        </p>
      </div>

      {/* Active Session Banner */}
      {currentSession && currentSession.status === "in_progress" && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Kamu punya sesi yang sedang berjalan
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Lanjutkan sesi sebelumnya atau batalkan dan mulai yang baru
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={onResumeSession}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  Lanjutkan Sesi
                </Button>
                <Button
                  onClick={onCancelAndStartNew}
                  variant="outline"
                  className="flex-1"
                >
                  Batalkan & Mulai Baru
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jenis Sesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={sessionType === "regular" ? "default" : "outline"}
              onClick={() => onSessionTypeChange("regular")}
              className="h-auto py-4 flex flex-col gap-1"
              disabled={isFromSchedule}
            >
              <Clock className="h-5 w-5" />
              <span>Regular</span>
            </Button>
            <Button
              variant={sessionType === "power" ? "default" : "outline"}
              onClick={() => onSessionTypeChange("power")}
              className={cn(
                "h-auto py-4 flex flex-col gap-1",
                sessionType === "power" && "bg-amber-600 hover:bg-amber-700"
              )}
              disabled={isFromSchedule}
            >
              <Zap className="h-5 w-5" />
              <span>Power</span>
            </Button>
          </div>
          {isFromSchedule && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Jenis sesi dari jadwal
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timer Settings with Mode Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Durasi Timer</CardTitle>
              <CardDescription>Atur sesuai kebutuhan</CardDescription>
            </div>
            <Tabs value={mode} onValueChange={(v) => handleModeChange(v as ConfigMode)}>
              <TabsList className="grid grid-cols-2 h-8">
                <TabsTrigger value="simple" className="text-xs px-3">Simple</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs px-3">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "simple" ? (
            <>
              {/* Simple Mode: Pump Duration */}
              <div className="flex items-center justify-between">
                <Label>Durasi Pump</Label>
                <Select
                  value={pumpMinutes.toString()}
                  onValueChange={(v) => setPumpMinutes(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 25, 30].map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} menit
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Simple Mode: Rest Duration */}
              <div className="flex items-center justify-between">
                <Label>Durasi Istirahat</Label>
                <Select
                  value={restMinutes.toString()}
                  onValueChange={(v) => setRestMinutes(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 10, 15].map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} menit
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Simple Mode: Pump Count */}
              <div className="flex items-center justify-between">
                <Label>Berapa kali pump</Label>
                <Select
                  value={pumpCount.toString()}
                  onValueChange={(v) => setPumpCount(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((c) => (
                      <SelectItem key={c} value={c.toString()}>
                        {c}x pump
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Simple Mode: Visual explanation */}
              {pumpCount > 1 && (
                <p className="text-xs text-muted-foreground text-center">
                  {Array.from({ length: pumpCount }, () => "Pump").join(" → Istirahat → ")}
                </p>
              )}

              {/* Simple Mode: Total Time Display */}
              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimasi total</span>
                  <span className="font-medium">~{simpleTotalMinutes} menit</span>
                </div>
              </div>
            </>
          ) : (
            /* Custom Mode: Interval Builder */
            <>
              <IntervalBuilder
                intervals={customIntervals}
                onChange={setCustomIntervals}
                maxIntervals={10}
              />
              {/* Custom Mode: Total Time Display */}
              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimasi total</span>
                  <span className="font-medium">~{Math.round(customTotalMinutes)} menit</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Start Button */}
      <Button onClick={handleStart} size="lg" className="w-full">
        Mulai Timer
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function TimerDisplay({
  timer,
  sessionType,
  onSwitch,
  onStop,
}: {
  timer: ReturnType<typeof useTimer>;
  sessionType: SessionType;
  onSwitch: () => void;
  onStop: () => void;
}) {
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const progress = timer.targetSeconds > 0
    ? ((timer.targetSeconds - timer.remainingSeconds) / timer.targetSeconds) * 100
    : 0;

  const isPumping = timer.currentIntervalType === "pump";

  const handleStopClick = () => {
    setShowStopConfirm(true);
  };

  const handleConfirmStop = () => {
    setShowStopConfirm(false);
    onStop();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-wide">
          {sessionType === "regular" ? "Regular" : "Power"} Pumping
        </p>
        {/* Pump phase indicator */}
        <p className="text-xs text-muted-foreground mt-1">
          Pump {timer.currentPump} dari {timer.totalPumps}
        </p>
      </div>

      {/* Timer Circle */}
      <div className="flex justify-center">
        <div
          className={cn(
            "relative h-56 w-56 rounded-full flex items-center justify-center",
            isPumping
              ? "bg-blue-50 dark:bg-blue-950"
              : "bg-green-50 dark:bg-green-950"
          )}
        >
          <div className="text-center">
            <p
              className={cn(
                "text-sm font-medium uppercase tracking-wide mb-2",
                isPumping
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-green-600 dark:text-green-400"
              )}
            >
              {isPumping ? "Pumping" : "Istirahat"}
            </p>
            <p className="text-5xl font-bold font-mono">
              {formatTime(timer.remainingSeconds)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">Pump</p>
          <p className="text-xl font-semibold">{formatTime(timer.totalPumpSeconds)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">Istirahat</p>
          <p className="text-xl font-semibold">{formatTime(timer.totalRestSeconds)}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        <Button
          size="lg"
          variant="outline"
          onClick={onSwitch}
          className="flex-1 max-w-[150px]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isPumping ? "Istirahat" : "Pump"}
        </Button>

        <Button
          size="lg"
          variant="destructive"
          onClick={handleStopClick}
          className="flex-1 max-w-[150px]"
        >
          <Square className="mr-2 h-4 w-4" />
          Stop
        </Button>
      </div>

      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Sesi?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghentikan sesi pumping? Hasil akan disimpan di layar berikutnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Lanjut Pumping</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Stop Sesi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AlarmOverlay({
  intervalType,
  currentPump,
  totalPumps,
  onDismiss,
}: {
  intervalType: "pump" | "rest";
  currentPump: number;
  totalPumps: number;
  onDismiss: () => void;
}) {
  const isLastPump = currentPump === totalPumps;

  // Determine button text
  // - After last pump: "Selesai" (session ends after last pump)
  // - After pump (not last): "Mulai Istirahat"
  // - After rest: "Mulai Pump"
  const getButtonText = () => {
    if (intervalType === "pump" && isLastPump) {
      return "Selesai";
    }
    return intervalType === "pump" ? "Mulai Istirahat" : "Mulai Pump";
  };

  return (
    <div className="fixed inset-0 z-50 bg-destructive/95 flex items-center justify-center animate-pulse">
      <div className="text-center space-y-6">
        <div className="text-white">
          <p className="text-2xl font-bold uppercase tracking-wide">
            Waktu Habis!
          </p>
          <p className="text-lg mt-2 opacity-80">
            {intervalType === "pump" ? "Pumping" : "Istirahat"} selesai
          </p>
          <p className="text-sm mt-1 opacity-60">
            Pump {currentPump} dari {totalPumps}
          </p>
        </div>

        <Button
          size="lg"
          variant="secondary"
          onClick={onDismiss}
          className="h-20 w-44 text-lg font-bold"
        >
          {getButtonText()}
        </Button>
      </div>
    </div>
  );
}

function SessionCompleteOverlay({
  onFinish,
}: {
  onFinish: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-green-600/95 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="text-white">
          <p className="text-3xl font-bold uppercase tracking-wide">
            Sesi Selesai!
          </p>
          <p className="text-lg mt-2 opacity-80">
            Semua siklus telah selesai
          </p>
        </div>

        <Button
          size="lg"
          variant="secondary"
          onClick={onFinish}
          className="h-20 w-44 text-lg font-bold"
        >
          Simpan Hasil
        </Button>
      </div>
    </div>
  );
}

function SessionComplete({
  sessionType,
  totalPumpSeconds,
  totalRestSeconds,
  volume,
  notes,
  isCompleted,
  onVolumeChange,
  onNotesChange,
  onIsCompletedChange,
  onSubmit,
  isSubmitting,
}: {
  sessionType: SessionType;
  totalPumpSeconds: number;
  totalRestSeconds: number;
  volume: string;
  notes: string;
  isCompleted: boolean;
  onVolumeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onIsCompletedChange: (value: boolean) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sesi Selesai</h1>
        <p className="text-muted-foreground mt-2">
          Masukkan hasil pumping
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ringkasan Sesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Jenis</p>
              <p className="font-medium capitalize">{sessionType === "regular" ? "Regular" : "Power"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Waktu</p>
              <p className="font-medium">
                {formatTime(totalPumpSeconds + totalRestSeconds)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Waktu Pump</p>
              <p className="font-medium">{formatTime(totalPumpSeconds)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Waktu Istirahat</p>
              <p className="font-medium">{formatTime(totalRestSeconds)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completion Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="completed" className="text-base">Sesi Tuntas</Label>
              <p className="text-sm text-muted-foreground">
                Apakah sesi ini diselesaikan dengan baik?
              </p>
            </div>
            <Switch
              id="completed"
              checked={isCompleted}
              onCheckedChange={onIsCompletedChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Volume Input */}
      <div className="space-y-2">
        <Label htmlFor="volume">Volume (ml)</Label>
        <Input
          id="volume"
          type="number"
          placeholder="Masukkan jumlah dalam ml"
          value={volume}
          onChange={(e) => onVolumeChange(e.target.value)}
          min={0}
          step={5}
        />
      </div>

      {/* Notes Input */}
      <div className="space-y-2">
        <Label htmlFor="notes">Catatan (opsional)</Label>
        <Input
          id="notes"
          type="text"
          placeholder="Catatan tentang sesi ini"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>

      <Button
        onClick={onSubmit}
        disabled={!volume || isSubmitting}
        className="w-full"
        size="lg"
      >
        {isSubmitting ? "Menyimpan..." : "Simpan Sesi"}
      </Button>
    </div>
  );
}
