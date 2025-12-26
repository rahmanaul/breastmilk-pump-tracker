import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAudioAlert } from "./useAudioAlert";

describe("useAudioAlert", () => {
  let mockOscillator: {
    frequency: { value: number };
    type: string;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };

  let mockGainNode: {
    gain: { value: number };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };

  let mockClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    mockOscillator = {
      frequency: { value: 0 },
      type: "sine",
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };

    mockGainNode = {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockClose = vi.fn(() => Promise.resolve());

    // Use a proper class for the mock
    class MockAudioContext {
      destination = {};
      createOscillator = vi.fn(() => mockOscillator);
      createGain = vi.fn(() => mockGainNode);
      close = mockClose;
    }

    // @ts-expect-error - mocking AudioContext
    window.AudioContext = MockAudioContext;
    // @ts-expect-error - mocking webkitAudioContext
    window.webkitAudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should not be playing initially", () => {
      const { result } = renderHook(() => useAudioAlert());

      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe("play", () => {
    it("should start playing audio", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
      expect(mockOscillator.start).toHaveBeenCalled();
    });

    it("should set oscillator to square wave at 800Hz", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      expect(mockOscillator.type).toBe("square");
      expect(mockOscillator.frequency.value).toBe(800);
    });

    it("should set gain to 0.5", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      expect(mockGainNode.gain.value).toBe(0.5);
    });

    it("should connect oscillator to gain", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      expect(mockOscillator.connect).toHaveBeenCalledWith(mockGainNode);
    });

    it("should not play if already playing", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      const startCallCount = mockOscillator.start.mock.calls.length;

      act(() => {
        result.current.play();
      });

      // Should not have called start again
      expect(mockOscillator.start).toHaveBeenCalledTimes(startCallCount);
    });

    it("should pulse frequency between 800 and 600", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      // Initial frequency is 800
      expect(mockOscillator.frequency.value).toBe(800);

      // After first interval (500ms): high=true → set 800, toggle to false
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(mockOscillator.frequency.value).toBe(800);

      // After second interval (1000ms total): high=false → set 600, toggle to true
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(mockOscillator.frequency.value).toBe(600);

      // After third interval (1500ms total): high=true → set 800, toggle to false
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(mockOscillator.frequency.value).toBe(800);
    });

    it("should trigger vibration on mobile", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      expect(navigator.vibrate).toHaveBeenCalledWith([500, 200, 500, 200, 500, 200]);
    });
  });

  describe("stop", () => {
    it("should stop playing audio", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.stop();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(mockOscillator.stop).toHaveBeenCalled();
      expect(mockOscillator.disconnect).toHaveBeenCalled();
      // AudioContext is now reused, not closed
    });

    it("should stop vibration", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      act(() => {
        result.current.stop();
      });

      expect(navigator.vibrate).toHaveBeenLastCalledWith(0);
    });

    it("should stop pulsing interval", () => {
      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      act(() => {
        result.current.stop();
      });

      const freqBefore = mockOscillator.frequency.value;

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Frequency should not change after stop
      expect(mockOscillator.frequency.value).toBe(freqBefore);
    });

    it("should handle stop when not playing", () => {
      const { result } = renderHook(() => useAudioAlert());

      // Should not throw
      act(() => {
        result.current.stop();
      });

      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle AudioContext creation error", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      class FailingAudioContext {
        constructor() {
          throw new Error("Audio not supported");
        }
      }

      // @ts-expect-error - mocking AudioContext to throw
      window.AudioContext = FailingAudioContext;

      const { result } = renderHook(() => useAudioAlert());

      act(() => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
});
