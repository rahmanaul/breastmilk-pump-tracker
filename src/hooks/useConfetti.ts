import { useCallback } from "react";
import confetti from "canvas-confetti";

interface ConfettiOptions {
  duration?: number;
  particleCount?: number;
  spread?: number;
  colors?: string[];
}

export function useConfetti() {
  const fire = useCallback((options: ConfettiOptions = {}) => {
    const {
      duration = 3000,
      particleCount = 100,
      spread = 70,
      colors = ["#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa"],
    } = options;

    const end = Date.now() + duration;

    // Create a celebration animation
    const frame = () => {
      void confetti({
        particleCount: Math.floor(particleCount / 10),
        angle: 60,
        spread,
        origin: { x: 0, y: 0.6 },
        colors,
      });
      void confetti({
        particleCount: Math.floor(particleCount / 10),
        angle: 120,
        spread,
        origin: { x: 1, y: 0.6 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  const burst = useCallback((options: ConfettiOptions = {}) => {
    const {
      particleCount = 150,
      spread = 100,
      colors = ["#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa"],
    } = options;

    // Single burst from center
    void confetti({
      particleCount,
      spread,
      origin: { x: 0.5, y: 0.5 },
      colors,
      startVelocity: 45,
      gravity: 1,
      ticks: 300,
      scalar: 1.2,
    });
  }, []);

  const celebration = useCallback(() => {
    // Multiple bursts for a bigger celebration
    const defaults = {
      spread: 360,
      ticks: 100,
      gravity: 0.5,
      decay: 0.94,
      startVelocity: 30,
      colors: ["#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa"],
    };

    function shoot() {
      void confetti({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ["circle", "square"],
        origin: { x: Math.random(), y: Math.random() * 0.3 },
      });

      void confetti({
        ...defaults,
        particleCount: 20,
        scalar: 2,
        shapes: ["circle"],
        origin: { x: Math.random(), y: Math.random() * 0.3 },
      });
    }

    // Fire multiple rounds
    shoot();
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
    setTimeout(shoot, 300);
  }, []);

  return { fire, burst, celebration };
}
