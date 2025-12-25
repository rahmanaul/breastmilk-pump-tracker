import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRetry, withRetry } from './useRetry';

describe('useRetry', () => {
  it('should return initial state', () => {
    const operation = vi.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useRetry(operation));

    expect(result.current.state).toEqual({
      isRetrying: false,
      attempt: 0,
      lastError: null,
    });
  });

  it('should execute operation successfully', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useRetry(operation));

    let response: string | undefined;
    await act(async () => {
      response = await result.current.execute('arg1');
    });

    expect(response).toBe('success');
    expect(operation).toHaveBeenCalledWith('arg1');
    expect(result.current.state.isRetrying).toBe(false);
  });

  it('should retry on failure and succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();
    const { result } = renderHook(() =>
      useRetry(operation, { onRetry, maxRetries: 2, initialDelay: 10 })
    );

    let response: string | undefined;
    await act(async () => {
      response = await result.current.execute();
    });

    expect(response).toBe('success');
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    expect(operation).toHaveBeenCalledTimes(2);
    expect(result.current.state.isRetrying).toBe(false);
  });

  it('should throw after max retries exceeded', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

    const { result } = renderHook(() =>
      useRetry(operation, { maxRetries: 2, initialDelay: 10 })
    );

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.execute();
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe('Always fails');
    expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(result.current.state.lastError?.message).toBe('Always fails');
  });

  it('should reset state', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() =>
      useRetry(operation, { maxRetries: 0 })
    );

    // Execute and let it fail
    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // Expected
      }
    });

    expect(result.current.state.lastError).not.toBeNull();

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({
      isRetrying: false,
      attempt: 0,
      lastError: null,
    });
  });
});

describe('withRetry', () => {
  it('should wrap operation with retry', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const wrappedOperation = withRetry(operation, {
      maxRetries: 2,
      initialDelay: 10
    });

    const response = await wrappedOperation('arg');

    expect(response).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should call onRetry callback', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();
    const wrappedOperation = withRetry(operation, {
      maxRetries: 3,
      initialDelay: 10,
      onRetry,
    });

    await wrappedOperation();

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
  });

  it('should throw after exhausting retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('persistent failure'));

    const wrappedOperation = withRetry(operation, {
      maxRetries: 1,
      initialDelay: 10,
    });

    await expect(wrappedOperation()).rejects.toThrow('persistent failure');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
