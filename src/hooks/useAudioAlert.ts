import { useCallback, useRef, useState, useEffect } from "react";

// Constants for alarm configuration
const ALARM_FREQUENCY_HIGH = 800; // Hz
const ALARM_FREQUENCY_LOW = 600; // Hz
const ALARM_PULSE_INTERVAL = 500; // ms
const ALARM_GAIN = 0.5;
const VIBRATE_PATTERN = [500, 200, 500, 200, 500, 200] as const;
const VIBRATE_REPEAT_INTERVAL = 2000; // ms
const NOTIFICATION_AUTO_CLOSE_TIMEOUT = 30000; // ms

interface AudioAlertState {
  isPlaying: boolean;
  play: (message?: string) => Promise<void>;
  stop: () => void;
  requestPermissions: () => Promise<boolean>;
}

export function useAudioAlert(): AudioAlertState {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const vibrateIntervalRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false); // Synchronous check to prevent race conditions
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);

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

  const play = useCallback(async (message = "Waktu habis! Saatnya berganti interval.") => {
    // Use ref for immediate synchronous check to prevent race conditions
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

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

      // Reuse or create audio context (browsers limit to 6-8 instances)
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      const audioContext = audioContextRef.current;

      // Create oscillator for alarm sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Loud, attention-grabbing alarm
      oscillator.frequency.value = ALARM_FREQUENCY_HIGH;
      oscillator.type = "square";
      gainNode.gain.value = ALARM_GAIN;

      oscillator.start();
      oscillatorRef.current = oscillator;

      // Create pulsing effect by modulating frequency
      let high = true;
      intervalRef.current = window.setInterval(() => {
        if (oscillatorRef.current) {
          oscillatorRef.current.frequency.value = high ? ALARM_FREQUENCY_HIGH : ALARM_FREQUENCY_LOW;
          high = !high;
        }
      }, ALARM_PULSE_INTERVAL);

      setIsPlaying(true);

      // Try to trigger vibration on mobile (continuous pattern)
      if ("vibrate" in navigator) {
        const vibratePattern = () => {
          navigator.vibrate(VIBRATE_PATTERN);
        };
        vibratePattern();
        // Continue vibrating at intervals
        vibrateIntervalRef.current = window.setInterval(vibratePattern, VIBRATE_REPEAT_INTERVAL);
      }
    } catch (error) {
      console.error("Failed to play alarm:", error);
      isPlayingRef.current = false; // Reset ref on error
    }
  }, []);

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
    setIsPlaying(false);
  }, []);

  return { isPlaying, play, stop, requestPermissions };
}
