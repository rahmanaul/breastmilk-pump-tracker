import { useCallback, useRef, useState, useEffect } from "react";

interface AudioAlertState {
  isPlaying: boolean;
  play: (message?: string) => void;
  stop: () => void;
  requestPermissions: () => Promise<boolean>;
}

export function useAudioAlert(): AudioAlertState {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false); // Synchronous check to prevent race conditions
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      // Don't auto-request, let user trigger it
    }
  }, []);

  // Request all necessary permissions
  const requestPermissions = useCallback(async () => {
    let granted = true;

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      granted = granted && permission === "granted";
    }

    return granted;
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
        const notification = new Notification("Breastmilk Pump Timer", {
          body: message,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          requireInteraction: true, // Notification stays until user interacts
          tag: "pump-alarm", // Replace previous notifications
          vibrate: [500, 200, 500, 200, 500], // Vibration pattern
        });

        // Auto-close notification after 30 seconds as fallback
        setTimeout(() => notification.close(), 30000);
      }

      // Create audio context
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // Create oscillator for alarm sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Loud, attention-grabbing alarm
      oscillator.frequency.value = 800;
      oscillator.type = "square";
      gainNode.gain.value = 0.5;

      oscillator.start();
      oscillatorRef.current = oscillator;

      // Create pulsing effect by modulating frequency
      let high = true;
      intervalRef.current = window.setInterval(() => {
        if (oscillatorRef.current) {
          oscillatorRef.current.frequency.value = high ? 800 : 600;
          high = !high;
        }
      }, 500);

      setIsPlaying(true);

      // Try to trigger vibration on mobile (continuous pattern)
      if ("vibrate" in navigator) {
        // Vibrate in a pattern: 500ms on, 200ms off, repeating
        const vibratePattern = () => {
          navigator.vibrate([500, 200, 500, 200, 500, 200]);
        };
        vibratePattern();
        // Continue vibrating every 2 seconds
        const vibrateInterval = window.setInterval(vibratePattern, 2000);
        (intervalRef as any).vibrateInterval = vibrateInterval;
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
      } catch {
        // Ignore if already stopped
      }
      oscillatorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        // Ignore if already closed
      }
      audioContextRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if ((intervalRef as any).vibrateInterval) {
      clearInterval((intervalRef as any).vibrateInterval);
      (intervalRef as any).vibrateInterval = null;
    }

    // Stop vibration
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
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
