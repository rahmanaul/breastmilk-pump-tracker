import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTimer } from "./useTimer";

describe("useTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
          totalPumps: 2,
        })
      );

      expect(result.current.isRunning).toBe(false);
      expect(result.current.currentIntervalType).toBe("pump");
      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.targetSeconds).toBe(120);
      expect(result.current.remainingSeconds).toBe(120);
      expect(result.current.intervals).toEqual([]);
      expect(result.current.totalPumpSeconds).toBe(0);
      expect(result.current.totalRestSeconds).toBe(0);
      expect(result.current.sessionStartTime).toBeNull();
      expect(result.current.isAlarmTriggered).toBe(false);
      expect(result.current.currentPump).toBe(1);
      expect(result.current.totalPumps).toBe(2);
      expect(result.current.isSessionComplete).toBe(false);
    });

    it("should support legacy totalCycles option", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
          totalCycles: 3,
        })
      );

      expect(result.current.totalPumps).toBe(3);
      expect(result.current.totalCycles).toBe(3); // Legacy alias
    });

    it("should default to 1 pump if not specified", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
        })
      );

      expect(result.current.totalPumps).toBe(1);
    });
  });

  describe("start", () => {
    it("should start the timer", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
        })
      );

      act(() => {
        result.current.start();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.currentIntervalType).toBe("pump");
      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.sessionStartTime).not.toBeNull();
    });

    it("should reset state when starting", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 10,
          restDuration: 5,
        })
      );

      // Start and advance
      act(() => {
        result.current.start();
      });
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.elapsedSeconds).toBe(5);

      // Start again - should reset
      act(() => {
        result.current.start();
      });

      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.intervals).toEqual([]);
      expect(result.current.currentPump).toBe(1);
    });
  });

  describe("timer counting", () => {
    it("should count seconds while running", async () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.elapsedSeconds).toBe(3);
      expect(result.current.remainingSeconds).toBe(117);
    });

    it("should track totalPumpSeconds while pumping", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.totalPumpSeconds).toBe(10);
      expect(result.current.totalRestSeconds).toBe(0);
    });
  });

  describe("pause and resume", () => {
    it("should pause the timer", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.elapsedSeconds).toBe(5);

      act(() => {
        result.current.pause();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should still be 5 because paused
      expect(result.current.elapsedSeconds).toBe(5);
    });

    it("should resume after pause", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 120,
          restDuration: 30,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.pause();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.resume();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.elapsedSeconds).toBe(8);
    });
  });

  describe("alarm trigger", () => {
    it("should trigger alarm when interval completes", () => {
      const onAlarmTrigger = vi.fn();
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
          onAlarmTrigger,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.isAlarmTriggered).toBe(true);
      expect(onAlarmTrigger).toHaveBeenCalledTimes(1);
    });

    it("should stop counting when alarm is triggered", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.isAlarmTriggered).toBe(true);
      expect(result.current.elapsedSeconds).toBe(5);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Should still be 5 because alarm is triggered (timer pauses)
      expect(result.current.elapsedSeconds).toBe(5);
    });

    it("should dismiss alarm", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.isAlarmTriggered).toBe(true);

      act(() => {
        result.current.dismissAlarm();
      });

      expect(result.current.isAlarmTriggered).toBe(false);
    });
  });

  describe("switchInterval", () => {
    it("should switch from pump to rest", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
          totalPumps: 2,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.switchInterval();
      });

      expect(result.current.currentIntervalType).toBe("rest");
      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.targetSeconds).toBe(3);
      expect(result.current.isAlarmTriggered).toBe(false);
      expect(result.current.intervals).toHaveLength(1);
      expect(result.current.intervals[0].type).toBe("pump");
    });

    it("should switch from rest to pump", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
          totalPumps: 2,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.switchInterval();
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      act(() => {
        result.current.switchInterval();
      });

      expect(result.current.currentIntervalType).toBe("pump");
      expect(result.current.currentPump).toBe(2);
      expect(result.current.intervals).toHaveLength(2);
    });

    it("should call onPumpComplete callback", () => {
      const onPumpComplete = vi.fn();
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
          totalPumps: 2,
          onPumpComplete,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.switchInterval();
      });

      expect(onPumpComplete).toHaveBeenCalledWith(1);
    });

    it("should mark session complete when last pump finishes", () => {
      const onAllCyclesComplete = vi.fn();
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
          totalPumps: 2,
          onAllCyclesComplete,
        })
      );

      act(() => {
        result.current.start();
      });

      // Complete pump 1
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      act(() => {
        result.current.switchInterval();
      });

      // Complete rest
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      act(() => {
        result.current.switchInterval();
      });

      // Complete pump 2 (last)
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      act(() => {
        result.current.switchInterval();
      });

      expect(result.current.isSessionComplete).toBe(true);
      expect(onAllCyclesComplete).toHaveBeenCalled();
    });
  });

  describe("skipToNextCycle", () => {
    it("should skip rest and go to next pump", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 10,
          restDuration: 5,
          totalPumps: 2,
        })
      );

      act(() => {
        result.current.start();
      });

      // Complete pump 1
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      act(() => {
        result.current.switchInterval();
      });

      expect(result.current.currentIntervalType).toBe("rest");
      expect(result.current.currentPump).toBe(1);

      // Wait a bit in rest
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Skip to next pump
      act(() => {
        result.current.skipToNextCycle();
      });

      expect(result.current.currentIntervalType).toBe("pump");
      expect(result.current.currentPump).toBe(2);
      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.intervals).toHaveLength(2);
      expect(result.current.intervals[1].type).toBe("rest");
      expect(result.current.intervals[1].duration).toBe(2);
    });

    it("should not skip if in pump interval", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 10,
          restDuration: 5,
          totalPumps: 2,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.skipToNextCycle();
      });

      // Should still be in pump
      expect(result.current.currentIntervalType).toBe("pump");
      expect(result.current.elapsedSeconds).toBe(5);
    });
  });

  describe("stop", () => {
    it("should stop and return final stats", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 10,
          restDuration: 5,
          totalPumps: 2,
        })
      );

      act(() => {
        result.current.start();
      });

      // Pump for 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      act(() => {
        result.current.switchInterval();
      });

      // Rest for 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      act(() => {
        result.current.switchInterval();
      });

      // Pump for 3 more seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      let stopResult: ReturnType<typeof result.current.stop>;
      act(() => {
        stopResult = result.current.stop();
      });

      expect(stopResult!.totalPumpSeconds).toBe(13); // 10 + 3
      expect(stopResult!.totalRestSeconds).toBe(5);
      expect(stopResult!.intervals).toHaveLength(3);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.elapsedSeconds).toBe(0);
    });

    it("should return empty stats if not running", () => {
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 10,
          restDuration: 5,
        })
      );

      let stopResult: ReturnType<typeof result.current.stop>;
      act(() => {
        stopResult = result.current.stop();
      });

      expect(stopResult!.intervals).toEqual([]);
      expect(stopResult!.totalPumpSeconds).toBe(0);
      expect(stopResult!.totalRestSeconds).toBe(0);
    });
  });

  describe("single pump session", () => {
    it("should mark session complete after one pump with totalPumps=1", () => {
      const onAllCyclesComplete = vi.fn();
      const { result } = renderHook(() =>
        useTimer({
          pumpDuration: 5,
          restDuration: 3,
          totalPumps: 1,
          onAllCyclesComplete,
        })
      );

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.switchInterval();
      });

      expect(result.current.isSessionComplete).toBe(true);
      expect(onAllCyclesComplete).toHaveBeenCalled();
    });
  });
});
