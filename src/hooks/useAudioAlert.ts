import { useCallback, useRef, useState } from "react";

interface AudioAlertState {
  isPlaying: boolean;
  play: () => void;
  stop: () => void;
}

export function useAudioAlert(): AudioAlertState {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false); // Synchronous check to prevent race conditions

  const play = useCallback(() => {
    // Use ref for immediate synchronous check to prevent race conditions
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    try {
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

      // Try to trigger vibration on mobile
      if ("vibrate" in navigator) {
        // Vibrate in a pattern: 500ms on, 200ms off, repeating
        const vibratePattern = () => {
          navigator.vibrate([500, 200]);
        };
        vibratePattern();
        // Continue vibrating
        const vibrateInterval = window.setInterval(vibratePattern, 700);
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

    isPlayingRef.current = false; // Reset ref synchronously
    setIsPlaying(false);
  }, []);

  return { isPlaying, play, stop };
}
