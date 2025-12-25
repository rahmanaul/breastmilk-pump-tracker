import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Slider } from "@/components/ui/slider";
import {
  Timer,
  Volume2,
  LogOut,
  Save,
  Check,
  Calendar,
  Bell,
  Plus,
  Minus,
  Clock,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

// Type for schedule item with sessionType
interface ScheduleItem {
  id: string;
  time: string;
  enabled: boolean;
  sessionType: "regular" | "power";
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Validate time format (HH:mm) - returns true if valid
function isValidTimeFormat(time: string): boolean {
  if (typeof time !== "string") return false;
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

// Normalize time to HH:mm format (pad single digit hours)
function normalizeTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function Settings() {
  const { signOut } = useAuthActions();
  const preferences = useQuery(api.preferences.get);
  const defaults = useQuery(api.preferences.getDefaults);
  const savePreferences = useMutation(api.preferences.save);

  // Default timer settings
  const [pumpMinutes, setPumpMinutes] = useState(15);
  const [restMinutes, setRestMinutes] = useState(5);
  const [pumpCount, setPumpCount] = useState(2); // How many pump phases
  const [alertVolume, setAlertVolume] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Session schedule state with sessionType
  const [sessionSchedule, setSessionSchedule] = useState<ScheduleItem[]>([
    { id: generateId(), time: "06:00", enabled: true, sessionType: "regular" },
    { id: generateId(), time: "09:00", enabled: true, sessionType: "power" },
    { id: generateId(), time: "12:00", enabled: true, sessionType: "regular" },
    { id: generateId(), time: "15:00", enabled: true, sessionType: "regular" },
    { id: generateId(), time: "18:00", enabled: true, sessionType: "power" },
    { id: generateId(), time: "21:00", enabled: true, sessionType: "regular" },
  ]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Sync with preferences when loaded
  useEffect(() => {
    if (preferences) {
      setAlertVolume(preferences.alertVolume);
      setNotificationsEnabled(preferences.notificationsEnabled ?? false);

      // Load schedule with sessionType
      if (preferences.sessionSchedule) {
        const scheduleWithTypes = preferences.sessionSchedule.map(
          (item: any) => ({
            id: item.id || generateId(),
            time: item.time,
            enabled: item.enabled,
            sessionType: item.sessionType || "regular",
          })
        );
        setSessionSchedule(scheduleWithTypes);
      }
    }
  }, [preferences]);

  // Sync with defaults
  useEffect(() => {
    if (defaults) {
      setPumpMinutes(Math.round(defaults.pumpDuration / 60));
      setRestMinutes(Math.round(defaults.restDuration / 60));
      setPumpCount(defaults.cycles);
    }
  }, [defaults]);

  const handleSave = async () => {
    // Validate all schedule times before saving
    const invalidTimes = sessionSchedule
      .map((s, i) => ({ index: i + 1, time: s.time, valid: isValidTimeFormat(s.time) }))
      .filter((s) => !s.valid);

    if (invalidTimes.length > 0) {
      toast.error("Format waktu tidak valid", {
        description: `Periksa jadwal ${invalidTimes.map((t) => `#${t.index}`).join(", ")}. Gunakan format HH:mm (contoh: 06:00, 14:30)`,
      });
      return;
    }

    setIsSaving(true);
    setSaved(false);
    try {
      await savePreferences({
        defaultPumpDuration: pumpMinutes * 60,
        defaultRestDuration: restMinutes * 60,
        defaultCycles: pumpCount, // Backend stores as cycles
        alertVolume,
        sessionSchedule,
        notificationsEnabled,
      });
      setSaved(true);
      toast.success("Pengaturan tersimpan");
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Gagal menyimpan pengaturan", {
        description: "Silakan coba lagi",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        setNotificationsEnabled(true);
      }
    }
  };

  const addSession = () => {
    if (sessionSchedule.length >= 12) return;
    const lastTime = sessionSchedule[sessionSchedule.length - 1]?.time || "06:00";
    const [hours, minutes] = lastTime.split(":").map(Number);
    const newHours = (hours + 3) % 24;
    const newTime = `${newHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    setSessionSchedule([
      ...sessionSchedule,
      { id: generateId(), time: newTime, enabled: true, sessionType: "regular" },
    ]);
  };

  const removeSession = () => {
    if (sessionSchedule.length <= 1) return;
    setSessionSchedule(sessionSchedule.slice(0, -1));
  };

  const updateSessionTime = (index: number, time: string) => {
    // Normalize and validate time
    const normalizedTime = normalizeTime(time);
    if (!isValidTimeFormat(normalizedTime)) {
      // Still update to show the invalid state, but don't save
      const updated = [...sessionSchedule];
      updated[index] = { ...updated[index], time };
      setSessionSchedule(updated);
      return;
    }
    const updated = [...sessionSchedule];
    updated[index] = { ...updated[index], time: normalizedTime };
    setSessionSchedule(updated);
  };

  const updateSessionType = (index: number, sessionType: "regular" | "power") => {
    const updated = [...sessionSchedule];
    updated[index] = { ...updated[index], sessionType };
    setSessionSchedule(updated);
  };

  const toggleSessionEnabled = (index: number) => {
    const updated = [...sessionSchedule];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setSessionSchedule(updated);
  };

  const handleSignOut = async () => {
    if (confirm("Yakin ingin keluar?")) {
      await signOut();
    }
  };

  if (!preferences) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-muted-foreground">Atur preferensi Anda</p>
      </div>

      {/* Default Timer Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Timer Default
          </CardTitle>
          <CardDescription>
            Pengaturan default (bisa diubah setiap mulai sesi)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Alarm Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Alarm
          </CardTitle>
          <CardDescription>Atur volume alarm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Volume</Label>
              <span className="text-sm text-muted-foreground">{alertVolume}%</span>
            </div>
            <Slider
              value={[alertVolume]}
              onValueChange={(value) => setAlertVolume(value[0])}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
          <AlarmTestButton volume={alertVolume} />
        </CardContent>
      </Card>

      {/* Session Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            Jadwal Harian
          </CardTitle>
          <CardDescription>
            Atur jadwal pumping dan jenis sesi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Number of sessions control */}
          <div className="flex items-center justify-between">
            <Label>Jumlah sesi per hari</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={removeSession}
                disabled={sessionSchedule.length <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium">
                {sessionSchedule.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={addSession}
                disabled={sessionSchedule.length >= 12}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Session time inputs with sessionType */}
          <div className="space-y-2">
            <Label>Jadwal</Label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {sessionSchedule.map((session, index) => (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg",
                    session.enabled ? "bg-muted/50" : "bg-muted/20"
                  )}
                >
                  <span className="text-xs text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  <Input
                    type="time"
                    value={session.time}
                    onChange={(e) => updateSessionTime(index, e.target.value)}
                    className={cn(
                      "w-32",
                      !isValidTimeFormat(session.time) && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {/* Session Type Toggle */}
                  <div className="flex gap-1">
                    <Button
                      variant={session.sessionType === "regular" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => updateSessionType(index, "regular")}
                      className={cn(
                        "h-8 w-8 p-0",
                        session.sessionType === "regular" &&
                          "bg-blue-600 hover:bg-blue-700"
                      )}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={session.sessionType === "power" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => updateSessionType(index, "power")}
                      className={cn(
                        "h-8 w-8 p-0",
                        session.sessionType === "power" &&
                          "bg-amber-600 hover:bg-amber-700"
                      )}
                    >
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                  <Switch
                    checked={session.enabled}
                    onCheckedChange={() => toggleSessionEnabled(index)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              Regular &nbsp;
              <Zap className="h-3 w-3 inline mr-1" />
              Power
            </p>
          </div>

          {/* Notifications toggle */}
          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notifications">Aktifkan notifikasi</Label>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
                disabled={notificationPermission !== "granted"}
              />
            </div>
            {notificationPermission !== "granted" && (
              <Button
                variant="outline"
                onClick={() => void requestNotificationPermission()}
                className="w-full"
                size="sm"
              >
                <Bell className="mr-2 h-4 w-4" />
                {notificationPermission === "denied"
                  ? "Notifikasi Diblokir"
                  : "Izinkan Notifikasi"}
              </Button>
            )}
            {notificationPermission === "denied" && (
              <p className="text-xs text-muted-foreground">
                Notifikasi diblokir. Aktifkan di pengaturan browser.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={() => void handleSave()}
        disabled={isSaving}
        className="w-full"
        size="lg"
      >
        {saved ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Tersimpan!
          </>
        ) : isSaving ? (
          "Menyimpan..."
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Simpan
          </>
        )}
      </Button>

      {/* Sign Out */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Akun</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => void handleSignOut()}
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AlarmTestButton({ volume }: { volume: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<{
    oscillator: OscillatorNode;
    audioContext: AudioContext;
    gainNode: GainNode;
  } | null>(null);

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
      gainNode.gain.value = (volume / 100) * 0.5;

      oscillator.start();
      setIsPlaying(true);

      audioRef.current = { oscillator, audioContext, gainNode };
    } catch (error) {
      console.error("Failed to play alarm:", error);
    }
  };

  useEffect(() => {
    if (audioRef.current?.gainNode) {
      audioRef.current.gainNode.gain.value = (volume / 100) * 0.5;
    }
  }, [volume]);

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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.oscillator.stop();
          void audioRef.current.audioContext.close();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return (
    <Button
      variant={isPlaying ? "destructive" : "outline"}
      onClick={playAlarm}
      className="w-full"
    >
      <Volume2 className="mr-2 h-4 w-4" />
      {isPlaying ? "Stop Alarm" : "Test Alarm"}
    </Button>
  );
}
