import { useCallback, useRef, useState, useEffect } from "react";

// Sound types available for alarm
export type AlertSoundType = "beep" | "chime" | "bell" | "gentle";

// Sound configurations for different alert types
interface SoundConfig {
  frequencyHigh: number;
  frequencyLow: number;
  pulseInterval: number;
  gain: number;
  waveType: OscillatorType;
}

const SOUND_CONFIGS: Record<AlertSoundType, SoundConfig> = {
  beep: {
    frequencyHigh: 800,
    frequencyLow: 600,
    pulseInterval: 500,
    gain: 0.5,
    waveType: "square",
  },
  chime: {
    frequencyHigh: 1200,
    frequencyLow: 800,
    pulseInterval: 300,
    gain: 0.4,
    waveType: "sine",
  },
  bell: {
    frequencyHigh: 523, // C5
    frequencyLow: 392, // G4
    pulseInterval: 600,
    gain: 0.5,
    waveType: "triangle",
  },
  gentle: {
    frequencyHigh: 440, // A4
    frequencyLow: 330, // E4
    pulseInterval: 800,
    gain: 0.3,
    waveType: "sine",
  },
};

const VIBRATE_PATTERN = [500, 200, 500, 200, 500, 200] as const;
const VIBRATE_REPEAT_INTERVAL = 2000; // ms
const NOTIFICATION_AUTO_CLOSE_TIMEOUT = 30000; // ms

interface AudioAlertState {
  isPlaying: boolean;
  isPending: boolean; // Alarm should play but blocked by autoplay policy
  soundType: AlertSoundType;
  setSoundType: (type: AlertSoundType) => void;
  play: (message?: string) => Promise<void>;
  stop: () => void;
  requestPermissions: () => Promise<boolean>;
  retryPlay: () => Promise<void>; // Retry playing when user interacts
  previewSound: (type: AlertSoundType) => void; // Preview a sound type
  stopPreview: () => void;
}

export function useAudioAlert(initialSoundType: AlertSoundType = "beep"): AudioAlertState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPending, setIsPending] = useState(false); // Alarm pending due to autoplay block
  const [soundType, setSoundType] = useState<AlertSoundType>(initialSoundType);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const previewOscillatorRef = useRef<OscillatorNode | null>(null);
  const previewContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const vibrateIntervalRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false); // Synchronous check to prevent race conditions
  const isPendingRef = useRef(false); // Synchronous check for pending state
  const pendingMessageRef = useRef<string>(""); // Store message for retry
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);
  const soundTypeRef = useRef<AlertSoundType>(initialSoundType);

  // Keep soundTypeRef in sync
  useEffect(() => {
    soundTypeRef.current = soundType;
  }, [soundType]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        // Re-acquire wake lock when returning to app
        if ("wakeLock" in navigator && !wakeLockRef.current) {
          navigator.wakeLock.request("screen")
            .then(lock => {
              wakeLockRef.current = lock;
              console.log("Wake Lock re-acquired after visibility change");
            })
            .catch(err => console.warn("Wake Lock re-acquire failed:", err));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying]);

  // Request all necessary permissions
  const requestPermissions = useCallback(async () => {
    if (!("Notification" in window)) return false;

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    // Return actual permission state (not always true)
    return Notification.permission === "granted";
  }, []);

  // Internal function to actually start the audio
  const startAudio = useCallback(async () => {
    try {
      // Reuse or create audio context (browsers limit to 6-8 instances)
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      const audioContext = audioContextRef.current;

      // CRITICAL: Resume AudioContext if suspended (autoplay policy)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // If still suspended after resume attempt, audio is blocked
      if (audioContext.state === "suspended") {
        console.warn("AudioContext still suspended - autoplay blocked");
        return false;
      }

      // Get sound configuration based on current sound type
      const config = SOUND_CONFIGS[soundTypeRef.current];

      // Create oscillator for alarm sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure based on sound type
      oscillator.frequency.value = config.frequencyHigh;
      oscillator.type = config.waveType;
      gainNode.gain.value = config.gain;

      oscillator.start();
      oscillatorRef.current = oscillator;

      // Create pulsing effect by modulating frequency
      let high = true;
      intervalRef.current = window.setInterval(() => {
        if (oscillatorRef.current) {
          oscillatorRef.current.frequency.value = high ? config.frequencyHigh : config.frequencyLow;
          high = !high;
        }
      }, config.pulseInterval);

      // Try to trigger vibration on mobile (continuous pattern)
      if ("vibrate" in navigator) {
        const vibratePattern = () => {
          navigator.vibrate(VIBRATE_PATTERN);
        };
        vibratePattern();
        // Continue vibrating at intervals
        vibrateIntervalRef.current = window.setInterval(vibratePattern, VIBRATE_REPEAT_INTERVAL);
      }

      return true;
    } catch (error) {
      console.error("Failed to start audio:", error);
      return false;
    }
  }, []);

  const play = useCallback(async (message = "Waktu habis! Saatnya berganti interval.") => {
    // Use ref for immediate synchronous check to prevent race conditions
    if (isPlayingRef.current) return;

    // Store message for potential retry
    pendingMessageRef.current = message;

    try {
      // Request wake lock to prevent screen from sleeping
      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          console.log("Wake Lock activated");
        } catch (err) {
          console.warn("Wake Lock failed:", err);
        }
      }

      // Show notification (works even when app is in background)
      if ("Notification" in window && Notification.permission === "granted") {
        // Close previous notification if exists
        if (notificationRef.current) {
          notificationRef.current.close();
        }
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }

        const notification = new Notification("Breastmilk Pump Timer", {
          body: message,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          requireInteraction: true, // Notification stays until user interacts
          tag: "pump-alarm", // Replace previous notifications
        });

        notificationRef.current = notification;

        // Auto-close notification after timeout as fallback
        notificationTimeoutRef.current = window.setTimeout(() => {
          notification.close();
          notificationRef.current = null;
        }, NOTIFICATION_AUTO_CLOSE_TIMEOUT);
      }

      // Try to start audio
      const audioStarted = await startAudio();

      if (audioStarted) {
        isPlayingRef.current = true;
        isPendingRef.current = false;
        setIsPlaying(true);
        setIsPending(false);
      } else {
        // Audio blocked by autoplay policy - set pending state
        console.warn("Audio blocked by autoplay policy - user interaction required");
        isPendingRef.current = true;
        setIsPending(true);
      }
    } catch (error) {
      console.error("Failed to play alarm:", error);
      // Set pending so user knows something is wrong
      isPendingRef.current = true;
      setIsPending(true);
    }
  }, [startAudio]);

  // Retry playing audio - call this on user interaction when isPending is true
  const retryPlay = useCallback(async () => {
    if (!isPendingRef.current || isPlayingRef.current) return;

    const audioStarted = await startAudio();

    if (audioStarted) {
      isPlayingRef.current = true;
      isPendingRef.current = false;
      setIsPlaying(true);
      setIsPending(false);
    }
  }, [startAudio]);

  const stop = useCallback(() => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch {
        // Ignore if already stopped
      }
      oscillatorRef.current = null;
    }

    // Keep AudioContext alive for reuse (don't close it)

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }

    // Stop vibration
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }

    // Close notification
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }

    // Release wake lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        console.log("Wake Lock released");
      }).catch((err) => {
        console.warn("Failed to release Wake Lock:", err);
      });
      wakeLockRef.current = null;
    }

    isPlayingRef.current = false; // Reset ref synchronously
    isPendingRef.current = false; // Reset pending ref too
    setIsPlaying(false);
    setIsPending(false);
  }, []);

  // Preview a sound type (plays briefly)
  const previewSound = useCallback((type: AlertSoundType) => {
    // Stop any existing preview
    if (previewOscillatorRef.current) {
      try {
        previewOscillatorRef.current.stop();
        previewOscillatorRef.current.disconnect();
      } catch {
        // Ignore
      }
    }

    try {
      if (!previewContextRef.current) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        previewContextRef.current = new AudioContextClass();
      }
      const audioContext = previewContextRef.current;

      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }

      const config = SOUND_CONFIGS[type];
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = config.frequencyHigh;
      oscillator.type = config.waveType;
      gainNode.gain.value = config.gain;

      oscillator.start();
      previewOscillatorRef.current = oscillator;

      // Stop after 1 second
      setTimeout(() => {
        try {
          oscillator.stop();
          oscillator.disconnect();
          if (previewOscillatorRef.current === oscillator) {
            previewOscillatorRef.current = null;
          }
        } catch {
          // Ignore
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to preview sound:", error);
    }
  }, []);

  // Stop preview sound
  const stopPreview = useCallback(() => {
    if (previewOscillatorRef.current) {
      try {
        previewOscillatorRef.current.stop();
        previewOscillatorRef.current.disconnect();
      } catch {
        // Ignore
      }
      previewOscillatorRef.current = null;
    }
  }, []);

  return {
    isPlaying,
    isPending,
    soundType,
    setSoundType,
    play,
    stop,
    requestPermissions,
    retryPlay,
    previewSound,
    stopPreview,
  };
}
