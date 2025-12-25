import { useMutation } from "convex/react";
import { FunctionReference, DefaultFunctionArgs } from "convex/server";
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

interface MutationWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  showRetryToast?: boolean;
  retryMessage?: string;
  errorMessage?: string;
}

interface MutationWithRetryState {
  isLoading: boolean;
  isRetrying: boolean;
  attempt: number;
  error: Error | null;
}

type MutateFunction<Args, Result> = (args: Args) => Promise<Result | undefined>;

/**
 * Wraps a Convex mutation with retry logic and toast notifications.
 * Automatically retries failed mutations with exponential backoff.
 */
export function useMutationWithRetry<
  Mutation extends FunctionReference<"mutation", "public", DefaultFunctionArgs, unknown>
>(
  mutation: Mutation,
  options: MutationWithRetryOptions = {}
): {
  mutate: MutateFunction<Mutation["_args"], Mutation["_returnType"]>;
  state: MutationWithRetryState;
  reset: () => void;
} {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    showRetryToast = true,
    retryMessage = "Mencoba ulang...",
    errorMessage = "Operasi gagal. Silakan coba lagi.",
  } = options;

  const rawMutation = useMutation(mutation);
  const [state, setState] = useState<MutationWithRetryState>({
    isLoading: false,
    isRetrying: false,
    attempt: 0,
    error: null,
  });

  // Use ref to store the mutate function for retry action
  const mutateRef = useRef<MutateFunction<
    Mutation["_args"],
    Mutation["_returnType"]
  > | null>(null);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isRetrying: false,
      attempt: 0,
      error: null,
    });
  }, []);

  const mutate = useCallback(
    async (
      args: Mutation["_args"]
    ): Promise<Mutation["_returnType"] | undefined> => {
      setState({
        isLoading: true,
        isRetrying: false,
        attempt: 0,
        error: null,
      });

      let lastError: Error | null = null;
      let delay = retryDelay;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (rawMutation as any)(args);
          setState({
            isLoading: false,
            isRetrying: false,
            attempt: 0,
            error: null,
          });
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // If this was the last attempt, fail
          if (attempt === maxRetries) {
            setState({
              isLoading: false,
              isRetrying: false,
              attempt,
              error: lastError,
            });
            toast.error(errorMessage, {
              description: lastError.message,
              action: {
                label: "Coba Lagi",
                onClick: () => {
                  if (mutateRef.current) {
                    void mutateRef.current(args);
                  }
                },
              },
            });
            return undefined;
          }

          // Show retry toast if enabled
          if (showRetryToast) {
            toast.info(retryMessage, {
              description: `Percobaan ${attempt + 2} dari ${maxRetries + 1}`,
              duration: delay,
            });
          }

          // Update state for retry
          setState({
            isLoading: true,
            isRetrying: true,
            attempt: attempt + 1,
            error: lastError,
          });

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, 5000); // Exponential backoff, max 5s
        }
      }

      return undefined;
    },
    [rawMutation, maxRetries, retryDelay, showRetryToast, retryMessage, errorMessage]
  );

  // Update ref when mutate changes
  useEffect(() => {
    mutateRef.current = mutate;
  }, [mutate]);

  return { mutate, state, reset };
}
