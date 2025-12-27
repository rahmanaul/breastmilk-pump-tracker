import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMutationWithRetry } from './useMutationWithRetry';
import type { FunctionReference } from 'convex/server';

// Mock convex/react
vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { useMutation } from 'convex/react';
import { toast } from 'sonner';

describe('useMutationWithRetry', () => {
  const mockMutationFn = vi.fn();
  const mockMutation = {} as FunctionReference<'mutation', 'public'>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (useMutation as ReturnType<typeof vi.fn>).mockReturnValue(mockMutationFn);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useMutationWithRetry(mockMutation));

    expect(result.current.state).toEqual({
      isLoading: false,
      isRetrying: false,
      attempt: 0,
      error: null,
    });
  });

  it('should execute mutation successfully', async () => {
    mockMutationFn.mockResolvedValue('success');
    const { result } = renderHook(() => useMutationWithRetry(mockMutation));

    let response: unknown;
    await act(async () => {
      response = await result.current.mutate({ arg: 'test' });
    });

    expect(response).toBe('success');
    expect(mockMutationFn).toHaveBeenCalledWith({ arg: 'test' });
    expect(result.current.state).toEqual({
      isLoading: false,
      isRetrying: false,
      attempt: 0,
      error: null,
    });
  });

  it('should set isLoading to true while executing', async () => {
    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });
    mockMutationFn.mockReturnValue(promise);

    const { result } = renderHook(() => useMutationWithRetry(mockMutation));

    act(() => {
      result.current.mutate({});
    });

    expect(result.current.state.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!('done');
      await promise;
    });

    expect(result.current.state.isLoading).toBe(false);
  });

  it('should retry on failure and eventually succeed', async () => {
    mockMutationFn
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const { result } = renderHook(() =>
      useMutationWithRetry(mockMutation, {
        maxRetries: 2,
        retryDelay: 100,
        showRetryToast: true,
      })
    );

    let response: unknown;
    await act(async () => {
      const mutatePromise = result.current.mutate({});
      // Advance timers for retry delay
      await vi.advanceTimersByTimeAsync(200);
      response = await mutatePromise;
    });

    expect(response).toBe('success');
    expect(mockMutationFn).toHaveBeenCalledTimes(2);
    expect(toast.info).toHaveBeenCalled();
  });

  it('should show error toast after max retries', async () => {
    mockMutationFn.mockRejectedValue(new Error('Persistent failure'));

    const { result } = renderHook(() =>
      useMutationWithRetry(mockMutation, {
        maxRetries: 1,
        retryDelay: 100,
        errorMessage: 'Operation failed',
      })
    );

    await act(async () => {
      const mutatePromise = result.current.mutate({});
      // Advance through all retries
      await vi.advanceTimersByTimeAsync(500);
      await mutatePromise;
    });

    expect(mockMutationFn).toHaveBeenCalledTimes(2); // initial + 1 retry
    expect(toast.error).toHaveBeenCalledWith('Operation failed', expect.any(Object));
    expect(result.current.state.error).toBeInstanceOf(Error);
    expect(result.current.state.error?.message).toBe('Persistent failure');
  });

  it('should reset state', async () => {
    mockMutationFn.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() =>
      useMutationWithRetry(mockMutation, { maxRetries: 0 })
    );

    await act(async () => {
      await result.current.mutate({});
    });

    expect(result.current.state.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({
      isLoading: false,
      isRetrying: false,
      attempt: 0,
      error: null,
    });
  });

  it('should use default options with 2 retries', async () => {
    mockMutationFn.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useMutationWithRetry(mockMutation));

    await act(async () => {
      const mutatePromise = result.current.mutate({});
      // Advance enough time for all retries with exponential backoff
      await vi.advanceTimersByTimeAsync(15000);
      await mutatePromise;
    });

    expect(mockMutationFn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should handle non-Error thrown values', async () => {
    mockMutationFn.mockRejectedValue('string error');

    const { result } = renderHook(() =>
      useMutationWithRetry(mockMutation, { maxRetries: 0 })
    );

    await act(async () => {
      await result.current.mutate({});
    });

    expect(result.current.state.error).toBeInstanceOf(Error);
    expect(result.current.state.error?.message).toBe('string error');
  });

  it('should not show retry toast when disabled', async () => {
    mockMutationFn
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const { result } = renderHook(() =>
      useMutationWithRetry(mockMutation, {
        maxRetries: 1,
        retryDelay: 100,
        showRetryToast: false,
      })
    );

    await act(async () => {
      const mutatePromise = result.current.mutate({});
      await vi.advanceTimersByTimeAsync(200);
      await mutatePromise;
    });

    expect(toast.info).not.toHaveBeenCalled();
  });

  it('should return undefined after all retries fail', async () => {
    mockMutationFn.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() =>
      useMutationWithRetry(mockMutation, { maxRetries: 1, retryDelay: 100 })
    );

    let response: unknown;
    await act(async () => {
      const mutatePromise = result.current.mutate({});
      await vi.advanceTimersByTimeAsync(500);
      response = await mutatePromise;
    });

    expect(response).toBeUndefined();
  });

});
