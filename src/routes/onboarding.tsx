import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Volume2, Check, Timer } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type Step = "welcome" | "timer" | "alarm" | "complete";

const STEPS: Step[] = ["welcome", "timer", "alarm", "complete"];

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function Onboarding() {
  const navigate = useNavigate();
  const savePreferences = useMutation(api.preferences.save);

  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [isLoading, setIsLoading] = useState(false);

  // Simplified form state
  const [pumpMinutes, setPumpMinutes] = useState(15);
  const [restMinutes, setRestMinutes] = useState(5);
  const [pumpCount, setPumpCount] = useState(2); // How many pump phases

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const goNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Default schedule with mixed session types
      const defaultSchedule = [
        { id: generateId(), time: "06:00", enabled: true, sessionType: "regular" as const },
        { id: generateId(), time: "09:00", enabled: true, sessionType: "power" as const },
        { id: generateId(), time: "12:00", enabled: true, sessionType: "regular" as const },
        { id: generateId(), time: "15:00", enabled: true, sessionType: "regular" as const },
        { id: generateId(), time: "18:00", enabled: true, sessionType: "power" as const },
        { id: generateId(), time: "21:00", enabled: true, sessionType: "regular" as const },
      ];

      await savePreferences({
        defaultPumpDuration: pumpMinutes * 60,
        defaultRestDuration: restMinutes * 60,
        defaultCycles: pumpCount, // Backend stores as cycles
        alertVolume: 100,
        sessionSchedule: defaultSchedule,
        notificationsEnabled: false,
      });
      void navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <Progress value={progress} className="mb-8" />

      <div className="flex-1 flex items-center justify-center">
        {currentStep === "welcome" && <WelcomeStep onNext={goNext} />}

        {currentStep === "timer" && (
          <TimerDefaultsStep
            pumpMinutes={pumpMinutes}
            restMinutes={restMinutes}
            pumpCount={pumpCount}
            onPumpChange={setPumpMinutes}
            onRestChange={setRestMinutes}
            onPumpCountChange={setPumpCount}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {currentStep === "alarm" && (
          <AlarmTestStep onNext={goNext} onBack={goBack} />
        )}

        {currentStep === "complete" && (
          <CompleteStep
            onBack={goBack}
            onComplete={() => void handleComplete()}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle className="text-2xl">Selamat Datang!</CardTitle>
        <CardDescription>
          Mari atur preferensi pumping Anda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground">
          Kami akan mengatur timer default dan jadwal harian Anda. Pengaturan ini
          bisa diubah kapan saja di Settings.
        </p>
        <Button onClick={onNext} className="w-full">
          Mulai <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function TimerDefaultsStep({
  pumpMinutes,
  restMinutes,
  pumpCount,
  onPumpChange,
  onRestChange,
  onPumpCountChange,
  onNext,
  onBack,
}: {
  pumpMinutes: number;
  restMinutes: number;
  pumpCount: number;
  onPumpChange: (value: number) => void;
  onRestChange: (value: number) => void;
  onPumpCountChange: (value: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  // N pumps = N*pumpMinutes + (N-1)*restMinutes
  const totalMinutes = pumpCount * pumpMinutes + (pumpCount - 1) * restMinutes;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Timer Default
        </CardTitle>
        <CardDescription>
          Pengaturan default yang bisa diubah setiap mulai sesi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Durasi Pump</Label>
            <Select
              value={pumpMinutes.toString()}
              onValueChange={(v) => onPumpChange(parseInt(v))}
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

          <div className="flex items-center justify-between">
            <Label>Durasi Istirahat</Label>
            <Select
              value={restMinutes.toString()}
              onValueChange={(v) => onRestChange(parseInt(v))}
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

          <div className="flex items-center justify-between">
            <Label>Berapa kali pump</Label>
            <Select
              value={pumpCount.toString()}
              onValueChange={(v) => onPumpCountChange(parseInt(v))}
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

          <div className="pt-3 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimasi total</span>
              <span className="font-medium">~{totalMinutes} menit</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ChevronLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <Button onClick={onNext} className="flex-1">
            Lanjut <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlarmTestStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<any>(null);

  const playAlarm = () => {
    if (isPlaying) {
      stopAlarm();
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "square";
      gainNode.gain.value = 0.3;

      oscillator.start();
      setIsPlaying(true);

      audioRef.current = { oscillator, audioContext };
    } catch (error) {
      console.error("Failed to play alarm:", error);
    }
  };

  const stopAlarm = () => {
    if (audioRef.current) {
      try {
        audioRef.current.oscillator.stop();
        void audioRef.current.audioContext.close();
      } catch {
        // Ignore
      }
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Test Alarm</CardTitle>
        <CardDescription>
          Pastikan alarm cukup keras untuk didengar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <Button
            size="lg"
            variant={isPlaying ? "destructive" : "default"}
            onClick={playAlarm}
            className="h-20 w-20 rounded-full"
          >
            <Volume2 className="h-8 w-8" />
          </Button>
          <p className="text-sm text-muted-foreground">
            {isPlaying ? "Tap untuk stop" : "Tap untuk test alarm"}
          </p>
        </div>

        <p className="text-sm text-center text-muted-foreground">
          Alarm akan berbunyi terus sampai Anda tap untuk menghentikannya
        </p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              stopAlarm();
              onBack();
            }}
            className="flex-1"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <Button
            onClick={() => {
              stopAlarm();
              onNext();
            }}
            className="flex-1"
          >
            Lanjut <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompleteStep({
  onBack,
  onComplete,
  isLoading,
}: {
  onBack: () => void;
  onComplete: () => void;
  isLoading: boolean;
}) {
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle className="text-2xl">Siap!</CardTitle>
        <CardDescription>
          Pengaturan Anda sudah tersimpan. Anda bisa mengubahnya kapan saja di
          Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Jadwal default sudah diatur dengan 6 sesi per hari. Anda bisa
          menyesuaikan jadwal dan jenis pumping (Regular/Power) di Settings.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ChevronLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <Button onClick={onComplete} disabled={isLoading} className="flex-1">
            {isLoading ? "Menyimpan..." : "Mulai Tracking"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
