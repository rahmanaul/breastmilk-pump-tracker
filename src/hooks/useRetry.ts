import { useState, useCallback, useRef } from "react";

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError: Error | null;
}

/**
 * Hook that provides retry functionality for async operations.
 * Uses exponential backoff with configurable options.
 */
export function useRetry<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): {
  execute: (...args: TArgs) => Promise<TResult>;
  state: RetryState;
  reset: () => void;
} {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    lastError: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({
      isRetrying: false,
      attempt: 0,
      lastError: null,
    });
  }, []);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      // Create new abort controller for this execution
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      let lastError: Error | null = null;
      let delay = initialDelay;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check if aborted
        if (signal.aborted) {
          throw new Error("Operation aborted");
        }

        try {
          setState({
            isRetrying: attempt > 0,
            attempt,
            lastError: null,
          });

          const result = await operation(...args);

          // Success - reset state
          setState({
            isRetrying: false,
            attempt: 0,
            lastError: null,
          });

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // If this was the last attempt, throw
          if (attempt === maxRetries) {
            setState({
              isRetrying: false,
              attempt,
              lastError,
            });
            throw lastError;
          }

          // Notify about retry
          onRetry?.(attempt + 1, lastError);

          // Update state
          setState({
            isRetrying: true,
            attempt: attempt + 1,
            lastError,
          });

          // Wait before retrying (with exponential backoff)
          await sleep(delay);
          delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
      }

      // Should not reach here, but TypeScript needs it
      throw lastError ?? new Error("Unknown error");
    },
    [operation, maxRetries, initialDelay, maxDelay, backoffMultiplier, onRetry]
  );

  return { execute, state, reset };
}

/**
 * Simplified retry wrapper for one-off operations.
 * Returns a function that will retry on failure.
 */
export function withRetry<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  return async (...args: TArgs): Promise<TResult> => {
    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation(...args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          throw lastError;
        }

        onRetry?.(attempt + 1, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError ?? new Error("Unknown error");
  };
}
