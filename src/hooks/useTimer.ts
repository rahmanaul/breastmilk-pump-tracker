import { useState, useEffect, useCallback, useRef } from "react";

export type IntervalType = "pump" | "rest";

// Recorded interval during session execution
export interface TimerInterval {
  type: IntervalType;
  startTime: number;
  endTime?: number;
  duration: number; // in seconds
}

// Custom interval definition for configuration
export interface CustomInterval {
  id: string;
  type: IntervalType;
  duration: number; // seconds
}

export interface TimerState {
  isRunning: boolean;
  currentIntervalType: IntervalType;
  currentIntervalIndex: number; // 0-indexed position in intervals array
  elapsedSeconds: number; // elapsed in current interval
  targetSeconds: number; // target for current interval
  remainingSeconds: number; // remaining in current interval
  completedIntervals: TimerInterval[]; // intervals that have been completed
  totalPumpSeconds: number;
  totalRestSeconds: number;
  sessionStartTime: number | null;
  isAlarmTriggered: boolean;
  // Pump phase tracking for display
  currentPump: number; // 1-indexed (which pump phase we're on)
  totalPumps: number; // total number of pump phases
  isSessionComplete: boolean; // all intervals done
  // Total intervals info
  totalIntervals: number;
  // Legacy aliases for backward compatibility
  currentCycle: number;
  totalCycles: number;
  intervals: TimerInterval[]; // alias for completedIntervals
}

interface UseTimerOptions {
  // New: custom intervals array
  intervals?: CustomInterval[];
  // Legacy: uniform durations (will be converted to intervals internally)
  pumpDuration?: number; // seconds
  restDuration?: number; // seconds
  totalPumps?: number; // number of pump phases (e.g., 2 = pump→rest→pump)
  totalCycles?: number; // DEPRECATED: alias for totalPumps for backward compatibility
  // Callbacks
  onAlarmTrigger?: () => void;
  onIntervalComplete?: (intervalIndex: number, interval: CustomInterval) => void;
  onPumpComplete?: (pumpNumber: number) => void; // called when a pump phase completes
  onCycleComplete?: (cycleNumber: number) => void; // DEPRECATED: alias for onPumpComplete
  onAllCyclesComplete?: () => void; // called when all intervals are done
}

// State to resume from (calculated from saved session data)
export interface ResumeState {
  currentIntervalIndex: number;
  elapsedInCurrentInterval: number; // seconds elapsed in current interval
  completedIntervals: TimerInterval[];
  // Legacy fields for backward compatibility
  currentIntervalType?: IntervalType;
  currentPump?: number;
}

interface UseTimerReturn extends TimerState {
  start: () => void;
  pause: () => void;
  resume: () => void;
  resumeFromState: (state: ResumeState) => void; // Resume from saved state
  switchInterval: () => void;
  stop: () => { intervals: TimerInterval[]; totalPumpSeconds: number; totalRestSeconds: number };
  dismissAlarm: () => void;
  skipToNextCycle: () => void; // skip current interval and go to next pump
  // New: access to configured intervals
  configuredIntervals: CustomInterval[];
}

// Helper to generate intervals from legacy format
function generateIntervalsFromLegacy(
  pumpDuration: number,
  restDuration: number,
  totalPumps: number
): CustomInterval[] {
  const intervals: CustomInterval[] = [];
  for (let i = 0; i < totalPumps; i++) {
    // Add pump interval
    intervals.push({
      id: `pump-${i + 1}`,
      type: "pump",
      duration: pumpDuration,
    });
    // Add rest interval (except after last pump)
    if (i < totalPumps - 1) {
      intervals.push({
        id: `rest-${i + 1}`,
        type: "rest",
        duration: restDuration,
      });
    }
  }
  return intervals;
}

export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const {
    intervals: customIntervals,
    pumpDuration = 900,
    restDuration = 300,
    totalPumps: _totalPumps,
    totalCycles: _totalCycles,
    onAlarmTrigger,
    onIntervalComplete,
    onPumpComplete,
    onCycleComplete,
    onAllCyclesComplete,
  } = options;

  // Determine configured intervals
  const configuredIntervals = customIntervals ?? generateIntervalsFromLegacy(
    pumpDuration,
    restDuration,
    _totalPumps ?? _totalCycles ?? 1
  );

  // Calculate total pumps for display
  const totalPumps = configuredIntervals.filter(i => i.type === "pump").length;
  const totalIntervals = configuredIntervals.length;

  const onPumpDone = onPumpComplete ?? onCycleComplete;

  const [isRunning, setIsRunning] = useState(false);
  const [currentIntervalIndex, setCurrentIntervalIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedIntervals, setCompletedIntervals] = useState<TimerInterval[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [isAlarmTriggered, setIsAlarmTriggered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const currentIntervalStartRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef<number>(0);
  // Store configured intervals in ref for stable access
  const configuredIntervalsRef = useRef(configuredIntervals);

  // Update ref when configuredIntervals changes (using useEffect to avoid ref mutation during render)
  useEffect(() => {
    configuredIntervalsRef.current = configuredIntervals;
  }, [configuredIntervals]);

  // Current interval info
  const currentInterval = configuredIntervals[currentIntervalIndex];
  const currentIntervalType = currentInterval?.type ?? "pump";
  const targetSeconds = currentInterval?.duration ?? pumpDuration;
  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);

  // Calculate which pump we're on (1-indexed)
  const currentPump = configuredIntervals
    .slice(0, currentIntervalIndex + 1)
    .filter(i => i.type === "pump").length;

  // Calculate totals
  const totalPumpSeconds = completedIntervals
    .filter((i) => i.type === "pump")
    .reduce((sum, i) => sum + i.duration, 0) +
    (isRunning && currentIntervalType === "pump" ? elapsedSeconds : 0);

  const totalRestSeconds = completedIntervals
    .filter((i) => i.type === "rest")
    .reduce((sum, i) => sum + i.duration, 0) +
    (isRunning && currentIntervalType === "rest" ? elapsedSeconds : 0);

  // Timer tick effect
  useEffect(() => {
    if (isRunning && !isPaused && !isAlarmTriggered && !isSessionComplete) {
      intervalRef.current = window.setInterval(() => {
        if (currentIntervalStartRef.current) {
          const now = Date.now();
          const actualElapsed = Math.floor((now - currentIntervalStartRef.current) / 1000);

          setElapsedSeconds(actualElapsed);
          elapsedSecondsRef.current = actualElapsed;

          // Get current target from ref (stable reference)
          const currentConfig = configuredIntervalsRef.current[currentIntervalIndex];
          const currentTarget = currentConfig?.duration ?? 0;

          if (actualElapsed >= currentTarget && !isAlarmTriggered) {
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
  }, [isRunning, isPaused, isAlarmTriggered, isSessionComplete, currentIntervalIndex, onAlarmTrigger]);

  const start = useCallback(() => {
    const now = Date.now();
    setSessionStartTime(now);
    currentIntervalStartRef.current = now;
    setCurrentIntervalIndex(0);
    setElapsedSeconds(0);
    setCompletedIntervals([]);
    setIsRunning(true);
    setIsPaused(false);
    setIsAlarmTriggered(false);
    setIsSessionComplete(false);
  }, []);

  const resumeFromState = useCallback((state: ResumeState) => {
    const now = Date.now();
    setSessionStartTime(now - state.elapsedInCurrentInterval * 1000);
    currentIntervalStartRef.current = now - state.elapsedInCurrentInterval * 1000;
    setCurrentIntervalIndex(state.currentIntervalIndex);
    setElapsedSeconds(state.elapsedInCurrentInterval);
    setCompletedIntervals(state.completedIntervals);
    setIsRunning(true);
    setIsPaused(false);
    setIsAlarmTriggered(false);
    setIsSessionComplete(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    if (currentIntervalStartRef.current) {
      const now = Date.now();
      const elapsed = Math.floor((now - currentIntervalStartRef.current) / 1000);
      setElapsedSeconds(elapsed);
      elapsedSecondsRef.current = elapsed;
    }
  }, []);

  const resume = useCallback(() => {
    if (currentIntervalStartRef.current) {
      const now = Date.now();
      currentIntervalStartRef.current = now - (elapsedSecondsRef.current * 1000);
    }
    setIsPaused(false);
  }, []);

  const switchInterval = useCallback(() => {
    if (!isRunning) return;

    const now = Date.now();
    const intervals = configuredIntervalsRef.current;
    const currentConfig = intervals[currentIntervalIndex];

    // Save current interval
    const completedInterval: TimerInterval = {
      type: currentConfig?.type ?? "pump",
      startTime: currentIntervalStartRef.current || now,
      endTime: now,
      duration: elapsedSeconds,
    };

    setCompletedIntervals((prev) => [...prev, completedInterval]);

    // Call interval complete callback
    if (currentConfig) {
      onIntervalComplete?.(currentIntervalIndex, currentConfig);
    }

    // If this was a pump, call pump complete callback
    if (currentConfig?.type === "pump") {
      const pumpNumber = intervals
        .slice(0, currentIntervalIndex + 1)
        .filter(i => i.type === "pump").length;
      onPumpDone?.(pumpNumber);
    }

    // Check if we're at the last interval
    if (currentIntervalIndex >= intervals.length - 1) {
      setIsSessionComplete(true);
      onAllCyclesComplete?.();
    } else {
      // Move to next interval
      setCurrentIntervalIndex(currentIntervalIndex + 1);
    }

    setElapsedSeconds(0);
    setIsAlarmTriggered(false);
    currentIntervalStartRef.current = now;
  }, [isRunning, currentIntervalIndex, elapsedSeconds, onIntervalComplete, onPumpDone, onAllCyclesComplete]);

  const skipToNextCycle = useCallback(() => {
    if (!isRunning) return;

    const now = Date.now();
    const intervals = configuredIntervalsRef.current;
    const currentConfig = intervals[currentIntervalIndex];

    // Only skip if we're on a rest interval
    if (currentConfig?.type !== "rest") return;

    // Save current rest interval
    const completedInterval: TimerInterval = {
      type: "rest",
      startTime: currentIntervalStartRef.current || now,
      endTime: now,
      duration: elapsedSeconds,
    };

    setCompletedIntervals((prev) => [...prev, completedInterval]);

    // Find next pump interval
    let nextPumpIndex = currentIntervalIndex + 1;
    while (nextPumpIndex < intervals.length && intervals[nextPumpIndex].type !== "pump") {
      nextPumpIndex++;
    }

    if (nextPumpIndex >= intervals.length) {
      // No more pump intervals, session complete
      setIsSessionComplete(true);
      onAllCyclesComplete?.();
    } else {
      setCurrentIntervalIndex(nextPumpIndex);
    }

    setElapsedSeconds(0);
    setIsAlarmTriggered(false);
    currentIntervalStartRef.current = now;
  }, [isRunning, currentIntervalIndex, elapsedSeconds, onAllCyclesComplete]);

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
    const currentConfig = configuredIntervalsRef.current[currentIntervalIndex];

    // Save final interval if any elapsed time
    const finalIntervals = [...completedIntervals];
    if (elapsedSeconds > 0) {
      finalIntervals.push({
        type: currentConfig?.type ?? "pump",
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
    setCompletedIntervals([]);
    setSessionStartTime(null);
    setCurrentIntervalIndex(0);
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
  }, [isRunning, completedIntervals, elapsedSeconds, currentIntervalIndex]);

  return {
    isRunning,
    currentIntervalType,
    currentIntervalIndex,
    elapsedSeconds,
    targetSeconds,
    remainingSeconds,
    completedIntervals,
    intervals: completedIntervals, // alias for backward compat
    totalPumpSeconds,
    totalRestSeconds,
    sessionStartTime,
    isAlarmTriggered,
    currentPump,
    totalPumps,
    totalIntervals,
    // Legacy aliases
    currentCycle: currentPump,
    totalCycles: totalPumps,
    isSessionComplete,
    // Methods
    start,
    pause,
    resume,
    resumeFromState,
    switchInterval,
    stop,
    dismissAlarm,
    skipToNextCycle,
    configuredIntervals,
  };
}
