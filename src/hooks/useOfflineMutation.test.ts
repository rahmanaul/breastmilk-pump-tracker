import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineMutation } from './useOfflineMutation';
import type { FunctionReference } from 'convex/server';

// Mock dependencies
vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}));

vi.mock('./useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}));

vi.mock('@/lib/offlineQueue', () => ({
  queueMutation: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { useMutation } from 'convex/react';
import { useOnlineStatus } from './useOnlineStatus';
import { queueMutation } from '@/lib/offlineQueue';
import { toast } from 'sonner';

describe('useOfflineMutation', () => {
  const mockMutationFn = vi.fn();
  const mockMutation = {} as FunctionReference<'mutation'>;

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as ReturnType<typeof vi.fn>).mockReturnValue(mockMutationFn);
  });

  it('should execute mutation normally when online', async () => {
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockMutationFn.mockResolvedValue('result');

    const { result } = renderHook(() =>
      useOfflineMutation(mockMutation, 'sessions.start')
    );

    let response: unknown;
    await act(async () => {
      response = await result.current({ type: 'regular' });
    });

    expect(response).toBe('result');
    expect(mockMutationFn).toHaveBeenCalledWith({ type: 'regular' });
    expect(queueMutation).not.toHaveBeenCalled();
  });

  it('should queue mutation when offline', async () => {
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (queueMutation as ReturnType<typeof vi.fn>).mockResolvedValue('queue-id-123');

    const { result } = renderHook(() =>
      useOfflineMutation(mockMutation, 'sessions.start')
    );

    let response: unknown;
    await act(async () => {
      response = await result.current({ type: 'regular' });
    });

    expect(response).toBeNull();
    expect(mockMutationFn).not.toHaveBeenCalled();
    expect(queueMutation).toHaveBeenCalledWith('sessions.start', { type: 'regular' });
    expect(toast.info).toHaveBeenCalledWith(
      'Anda sedang offline. Operasi disimpan dan akan disinkronkan saat online.',
      expect.any(Object)
    );
  });

  it('should show error toast when queuing fails', async () => {
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (queueMutation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Queue error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useOfflineMutation(mockMutation, 'sessions.start')
    );

    await expect(result.current({ type: 'regular' })).rejects.toThrow('Queue error');

    expect(toast.error).toHaveBeenCalledWith('Gagal menyimpan operasi offline');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to queue mutation:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should handle transition from online to offline', async () => {
    const mockUseOnlineStatus = useOnlineStatus as ReturnType<typeof vi.fn>;
    mockUseOnlineStatus.mockReturnValue(true);
    mockMutationFn.mockResolvedValue('online-result');
    (queueMutation as ReturnType<typeof vi.fn>).mockResolvedValue('queue-id');

    const { result, rerender } = renderHook(() =>
      useOfflineMutation(mockMutation, 'sessions.start')
    );

    // Execute online
    let response: unknown;
    await act(async () => {
      response = await result.current({ type: 'regular' });
    });

    expect(response).toBe('online-result');
    expect(mockMutationFn).toHaveBeenCalled();

    // Switch to offline
    mockUseOnlineStatus.mockReturnValue(false);
    rerender();

    // Execute offline
    await act(async () => {
      response = await result.current({ type: 'power' });
    });

    expect(response).toBeNull();
    expect(queueMutation).toHaveBeenCalledWith('sessions.start', { type: 'power' });
  });

  it('should pass complex args correctly when online', async () => {
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockMutationFn.mockResolvedValue('result');

    const { result } = renderHook(() =>
      useOfflineMutation(mockMutation, 'sessions.complete')
    );

    const complexArgs = {
      duration: 1800,
      volume: 150,
      notes: 'Test session',
      intervals: [
        { type: 'pump', duration: 600 },
        { type: 'rest', duration: 300 },
      ],
    };

    await act(async () => {
      await result.current(complexArgs);
    });

    expect(mockMutationFn).toHaveBeenCalledWith(complexArgs);
  });

  it('should pass complex args correctly when offline', async () => {
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (queueMutation as ReturnType<typeof vi.fn>).mockResolvedValue('queue-id');

    const { result } = renderHook(() =>
      useOfflineMutation(mockMutation, 'sessions.complete')
    );

    const complexArgs = {
      duration: 1800,
      volume: 150,
      notes: 'Test session',
      intervals: [
        { type: 'pump', duration: 600 },
        { type: 'rest', duration: 300 },
      ],
    };

    await act(async () => {
      await result.current(complexArgs);
    });

    expect(queueMutation).toHaveBeenCalledWith('sessions.complete', complexArgs);
  });

  it('should return undefined when mutation fails online', async () => {
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockMutationFn.mockRejectedValue(new Error('Mutation failed'));

    const { result } = renderHook(() =>
      useOfflineMutation(mockMutation, 'sessions.start')
    );

    await expect(result.current({ type: 'regular' })).rejects.toThrow('Mutation failed');
  });

  it('should use correct function name in queue id', async () => {
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (queueMutation as ReturnType<typeof vi.fn>).mockResolvedValue('preferences.save-123');

    const { result } = renderHook(() =>
      useOfflineMutation(mockMutation, 'preferences.save')
    );

    await act(async () => {
      await result.current({ goal: 300 });
    });

    expect(queueMutation).toHaveBeenCalledWith('preferences.save', { goal: 300 });
    expect(toast.info).toHaveBeenCalledWith(
      expect.any(String),
      { id: 'offline-queue-preferences.save-123' }
    );
  });
});
