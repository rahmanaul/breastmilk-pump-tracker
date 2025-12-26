import { useState, useEffect, useCallback, useRef } from "react";

export type IntervalType = "pump" | "rest";

export interface TimerInterval {
  type: IntervalType;
  startTime: number;
  endTime?: number;
  duration: number; // in seconds
}

export interface TimerState {
  isRunning: boolean;
  currentIntervalType: IntervalType;
  elapsedSeconds: number; // elapsed in current interval
  targetSeconds: number; // target for current interval
  remainingSeconds: number; // remaining in current interval
  intervals: TimerInterval[];
  totalPumpSeconds: number;
  totalRestSeconds: number;
  sessionStartTime: number | null;
  isAlarmTriggered: boolean;
  // Pump phase tracking (pump → rest → pump → rest → pump...)
  currentPump: number; // 1-indexed (which pump phase we're on)
  totalPumps: number; // total number of pump phases
  isSessionComplete: boolean; // all pumps done
  // Legacy aliases for backward compatibility
  currentCycle: number;
  totalCycles: number;
}

interface UseTimerOptions {
  pumpDuration: number; // seconds
  restDuration: number; // seconds
  totalPumps?: number; // number of pump phases (e.g., 2 = pump→rest→pump)
  totalCycles?: number; // DEPRECATED: alias for totalPumps for backward compatibility
  onAlarmTrigger?: () => void;
  onPumpComplete?: (pumpNumber: number) => void; // called when a pump phase completes
  onCycleComplete?: (cycleNumber: number) => void; // DEPRECATED: alias for onPumpComplete
  onAllCyclesComplete?: () => void; // called when all pump phases are done
}

// State to resume from (calculated from saved session data)
export interface ResumeState {
  currentIntervalType: IntervalType;
  elapsedInCurrentInterval: number; // seconds elapsed in current interval
  completedIntervals: TimerInterval[];
  currentPump: number;
}

interface UseTimerReturn extends TimerState {
  start: () => void;
  pause: () => void;
  resume: () => void;
  resumeFromState: (state: ResumeState) => void; // Resume from saved state
  switchInterval: () => void;
  stop: () => { intervals: TimerInterval[]; totalPumpSeconds: number; totalRestSeconds: number };
  dismissAlarm: () => void;
  skipToNextCycle: () => void; // NEW: skip rest and go to next pump cycle
}

export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const {
    pumpDuration,
    restDuration,
    totalPumps: _totalPumps,
    totalCycles: _totalCycles, // deprecated alias
    onAlarmTrigger,
    onPumpComplete,
    onCycleComplete, // deprecated alias
    onAllCyclesComplete,
  } = options;

  // Use totalPumps if provided, fall back to totalCycles for backward compatibility
  const totalPumps = _totalPumps ?? _totalCycles ?? 1;
  const onPumpDone = onPumpComplete ?? onCycleComplete;

  const [isRunning, setIsRunning] = useState(false);
  const [currentIntervalType, setCurrentIntervalType] = useState<IntervalType>("pump");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [intervals, setIntervals] = useState<TimerInterval[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [isAlarmTriggered, setIsAlarmTriggered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPump, setCurrentPump] = useState(1); // which pump phase we're on
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const currentIntervalStartRef = useRef<number | null>(null);

  const targetSeconds = currentIntervalType === "pump" ? pumpDuration : restDuration;
  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);

  // Calculate totals
  const totalPumpSeconds = intervals
    .filter((i) => i.type === "pump")
    .reduce((sum, i) => sum + i.duration, 0) +
    (isRunning && currentIntervalType === "pump" ? elapsedSeconds : 0);

  const totalRestSeconds = intervals
    .filter((i) => i.type === "rest")
    .reduce((sum, i) => sum + i.duration, 0) +
    (isRunning && currentIntervalType === "rest" ? elapsedSeconds : 0);

  // Timer tick effect - Use actual time instead of counter for accuracy
  useEffect(() => {
    if (isRunning && !isPaused && !isAlarmTriggered && !isSessionComplete) {
      intervalRef.current = window.setInterval(() => {
        if (currentIntervalStartRef.current) {
          const now = Date.now();
          const actualElapsed = Math.floor((now - currentIntervalStartRef.current) / 1000);

          setElapsedSeconds(actualElapsed);

          // Check if we've reached the target
          if (actualElapsed >= targetSeconds && !isAlarmTriggered) {
            setIsAlarmTriggered(true);
            onAlarmTrigger?.();
          }
        }
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRunning, isPaused, isAlarmTriggered, isSessionComplete, targetSeconds, onAlarmTrigger]);

  const start = useCallback(() => {
    const now = Date.now();
    setSessionStartTime(now);
    currentIntervalStartRef.current = now;
    setCurrentIntervalType("pump");
    setElapsedSeconds(0);
    setIntervals([]);
    setIsRunning(true);
    setIsPaused(false);
    setIsAlarmTriggered(false);
    setCurrentPump(1);
    setIsSessionComplete(false);
  }, []);

  // Resume from saved state (e.g., when coming back to an in-progress session)
  const resumeFromState = useCallback((state: ResumeState) => {
    const now = Date.now();
    setSessionStartTime(now - state.elapsedInCurrentInterval * 1000);
    currentIntervalStartRef.current = now - state.elapsedInCurrentInterval * 1000;
    setCurrentIntervalType(state.currentIntervalType);
    setElapsedSeconds(state.elapsedInCurrentInterval);
    setIntervals(state.completedIntervals);
    setIsRunning(true);
    setIsPaused(false);
    setIsAlarmTriggered(false);
    setCurrentPump(state.currentPump);
    setIsSessionComplete(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    // Store elapsed time at pause to resume from correct position later
    if (currentIntervalStartRef.current) {
      const now = Date.now();
      const elapsed = Math.floor((now - currentIntervalStartRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }
  }, []);

  const resume = useCallback(() => {
    // Adjust start time to account for paused duration
    if (currentIntervalStartRef.current) {
      const now = Date.now();
      currentIntervalStartRef.current = now - (elapsedSeconds * 1000);
    }
    setIsPaused(false);
  }, [elapsedSeconds]);

  const switchInterval = useCallback(() => {
    if (!isRunning) return;

    const now = Date.now();

    // Save current interval
    const completedInterval: TimerInterval = {
      type: currentIntervalType,
      startTime: currentIntervalStartRef.current || now,
      endTime: now,
      duration: elapsedSeconds,
    };

    setIntervals((prev) => [...prev, completedInterval]);

    // New logic: pump → rest → pump → rest → ... → pump (end)
    if (currentIntervalType === "pump") {
      // After pump completes
      onPumpDone?.(currentPump);

      if (currentPump >= totalPumps) {
        // This was the last pump - session complete!
        setIsSessionComplete(true);
        onAllCyclesComplete?.();
      } else {
        // More pumps to go, go to rest
        setCurrentIntervalType("rest");
      }
    } else {
      // After rest completes, go to next pump
      setCurrentPump((prev) => prev + 1);
      setCurrentIntervalType("pump");
    }

    setElapsedSeconds(0);
    setIsAlarmTriggered(false);
    currentIntervalStartRef.current = now;
  }, [isRunning, currentIntervalType, elapsedSeconds, currentPump, totalPumps, onPumpDone, onAllCyclesComplete]);

  const skipToNextCycle = useCallback(() => {
    if (!isRunning || currentIntervalType !== "rest") return;

    const now = Date.now();

    // Save current rest interval
    const completedInterval: TimerInterval = {
      type: "rest",
      startTime: currentIntervalStartRef.current || now,
      endTime: now,
      duration: elapsedSeconds,
    };

    setIntervals((prev) => [...prev, completedInterval]);

    // Go to next pump phase
    setCurrentPump((prev) => prev + 1);
    setCurrentIntervalType("pump");

    setElapsedSeconds(0);
    setIsAlarmTriggered(false);
    currentIntervalStartRef.current = now;
  }, [isRunning, currentIntervalType, elapsedSeconds]);

  const dismissAlarm = useCallback(() => {
    setIsAlarmTriggered(false);
  }, []);

  const stop = useCallback(() => {
    if (!isRunning) {
      return {
        intervals: [],
        totalPumpSeconds: 0,
        totalRestSeconds: 0,
      };
    }

    const now = Date.now();

    // Save final interval if any elapsed time
    const finalIntervals = [...intervals];
    if (elapsedSeconds > 0) {
      finalIntervals.push({
        type: currentIntervalType,
        startTime: currentIntervalStartRef.current || now,
        endTime: now,
        duration: elapsedSeconds,
      });
    }

    const finalPumpSeconds = finalIntervals
      .filter((i) => i.type === "pump")
      .reduce((sum, i) => sum + i.duration, 0);

    const finalRestSeconds = finalIntervals
      .filter((i) => i.type === "rest")
      .reduce((sum, i) => sum + i.duration, 0);

    // Reset state
    setIsRunning(false);
    setIsPaused(false);
    setIsAlarmTriggered(false);
    setElapsedSeconds(0);
    setIntervals([]);
    setSessionStartTime(null);
    setCurrentPump(1);
    setIsSessionComplete(false);
    currentIntervalStartRef.current = null;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return {
      intervals: finalIntervals,
      totalPumpSeconds: finalPumpSeconds,
      totalRestSeconds: finalRestSeconds,
    };
  }, [isRunning, intervals, elapsedSeconds, currentIntervalType]);

  return {
    isRunning,
    currentIntervalType,
    elapsedSeconds,
    targetSeconds,
    remainingSeconds,
    intervals,
    totalPumpSeconds,
    totalRestSeconds,
    sessionStartTime,
    isAlarmTriggered,
    // New naming
    currentPump,
    totalPumps,
    // Legacy aliases for backward compatibility
    currentCycle: currentPump,
    totalCycles: totalPumps,
    isSessionComplete,
    start,
    pause,
    resume,
    resumeFromState,
    switchInterval,
    stop,
    dismissAlarm,
    skipToNextCycle,
  };
}
