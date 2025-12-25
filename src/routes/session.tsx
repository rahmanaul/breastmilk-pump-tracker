import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
import { Progress } from "@/components/ui/progress";
import { useTimer } from "@/hooks/useTimer";
import { useAudioAlert } from "@/hooks/useAudioAlert";
import { Square, RefreshCw, Zap, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Search params type for route
type SessionSearchParams = {
  scheduleSlotId?: string;
  scheduledTime?: string;
  sessionType?: "regular" | "power";
};

export const Route = createFileRoute("/session")({
  component: Session,
  validateSearch: (search: Record<string, unknown>): SessionSearchParams => {
    return {
      scheduleSlotId: search.scheduleSlotId as string | undefined,
      scheduledTime: search.scheduledTime as string | undefined,
      sessionType: search.sessionType as "regular" | "power" | undefined,
    };
  },
});

type SessionType = "regular" | "power";
type SessionPhase = "config" | "timer" | "complete";

interface TimerConfig {
  pumpDuration: number; // seconds
  restDuration: number; // seconds
  pumpCount: number; // number of pump phases (e.g., 2 = pump→rest→pump)
}

function Session() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/session" });

  const defaults = useQuery(api.preferences.getDefaults);
  const startSession = useMutation(api.sessions.start);
  const switchIntervalMutation = useMutation(api.sessions.switchInterval);
  const completeSession = useMutation(api.sessions.complete);

  const [phase, setPhase] = useState<SessionPhase>("config");
  const [sessionType, setSessionType] = useState<SessionType>(
    search.sessionType || "regular"
  );
  const [timerConfig, setTimerConfig] = useState<TimerConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [volume, setVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [isCompleted, setIsCompleted] = useState(true); // tuntas
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalPumpSeconds, setFinalPumpSeconds] = useState(0);
  const [finalRestSeconds, setFinalRestSeconds] = useState(0);

  // Schedule info from search params
  const scheduleInfo = search.scheduleSlotId
    ? {
        slotId: search.scheduleSlotId,
        scheduledTime: search.scheduledTime ? parseInt(search.scheduledTime) : undefined,
      }
    : null;

  const audioAlert = useAudioAlert();

  const timer = useTimer({
    pumpDuration: timerConfig?.pumpDuration ?? 900,
    restDuration: timerConfig?.restDuration ?? 300,
    totalPumps: timerConfig?.pumpCount ?? 1,
    onAlarmTrigger: () => {
      audioAlert.play();
    },
    onAllCyclesComplete: () => {
      // Auto-stop when all pumps complete
      audioAlert.stop();
    },
  });

  // Stop alarm when dismissed
  useEffect(() => {
    if (!timer.isAlarmTriggered && audioAlert.isPlaying) {
      audioAlert.stop();
    }
  }, [timer.isAlarmTriggered, audioAlert]);

  const handleStartTimer = async (config: TimerConfig) => {
    setTimerConfig(config);
    try {
      const id = await startSession({
        sessionType,
        scheduleSlotId: scheduleInfo?.slotId,
        scheduledTime: scheduleInfo?.scheduledTime,
        timerConfig: {
          pumpDuration: config.pumpDuration,
          restDuration: config.restDuration,
          cycles: config.pumpCount, // Backend stores as cycles, frontend uses pumpCount
        },
      });
      setSessionId(id);
      // Timer will start after state update, use effect
      setPhase("timer");
    } catch (error) {
      console.error("Failed to start session:", error);
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
      try {
        await switchIntervalMutation({
          sessionId: sessionId as any,
          newIntervalType: newType,
        });
      } catch (error) {
        console.error("Failed to switch interval:", error);
      }
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

    setIsSubmitting(true);
    try {
      await completeSession({
        sessionId: sessionId as any,
        volume: parseFloat(volume),
        notes: notes || undefined,
        isCompleted,
      });
      void navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to complete session:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, volume, notes, isCompleted, completeSession, navigate]);

  if (!defaults) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading...</p>
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
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

// NEW: Session configuration screen
function SessionConfig({
  sessionType,
  onSessionTypeChange,
  scheduleInfo: _scheduleInfo,
  defaults,
  onStart,
  isFromSchedule,
}: {
  sessionType: SessionType;
  onSessionTypeChange: (type: SessionType) => void;
  scheduleInfo: { slotId: string; scheduledTime?: number } | null;
  defaults: { pumpDuration: number; restDuration: number; cycles: number };
  onStart: (config: TimerConfig) => void;
  isFromSchedule: boolean;
}) {
  const [pumpMinutes, setPumpMinutes] = useState(Math.floor(defaults.pumpDuration / 60));
  const [restMinutes, setRestMinutes] = useState(Math.floor(defaults.restDuration / 60));
  const [pumpCount, setPumpCount] = useState(defaults.cycles);

  // New calculation: N pumps = N*pumpMinutes + (N-1)*restMinutes
  // Example: 2 pumps = pump→rest→pump = 2*pump + 1*rest
  const totalMinutes = pumpCount * pumpMinutes + (pumpCount - 1) * restMinutes;

  const handleStart = () => {
    onStart({
      pumpDuration: pumpMinutes * 60,
      restDuration: restMinutes * 60,
      pumpCount,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Pengaturan Sesi</h1>
        <p className="text-muted-foreground mt-2">
          Atur durasi pumping dan istirahat
        </p>
      </div>

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

      {/* Timer Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Durasi Timer</CardTitle>
          <CardDescription>Atur sesuai kebutuhan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pump Duration */}
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

          {/* Rest Duration */}
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

          {/* Pump Count */}
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

          {/* Visual explanation */}
          {pumpCount > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              {Array.from({ length: pumpCount }, () => "Pump").join(" → Istirahat → ")}
            </p>
          )}

          {/* Total Time Display */}
          <div className="pt-3 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimasi total</span>
              <span className="font-medium">~{totalMinutes} menit</span>
            </div>
          </div>
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
