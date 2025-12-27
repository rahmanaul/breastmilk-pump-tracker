import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { OfflineProvider, useOffline } from './OfflineContext';
import React from 'react';

// Mock dependencies
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}));

vi.mock('@/lib/offlineQueue', () => ({
  getQueuedMutations: vi.fn(),
  removeMutation: vi.fn(),
  updateMutationRetryCount: vi.fn(),
  getQueuedCount: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the api module
vi.mock('../../convex/_generated/api', () => ({
  api: {
    sessions: {
      start: 'sessions.start',
      complete: 'sessions.complete',
      switchInterval: 'sessions.switchInterval',
      cancelCurrent: 'sessions.cancelCurrent',
      remove: 'sessions.remove',
    },
    preferences: {
      save: 'preferences.save',
      updateSchedule: 'preferences.updateSchedule',
      updateDefaults: 'preferences.updateDefaults',
      updateAlertVolume: 'preferences.updateAlertVolume',
    },
  },
}));

import { useMutation } from 'convex/react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  getQueuedMutations,
  removeMutation,
  updateMutationRetryCount,
  getQueuedCount,
} from '@/lib/offlineQueue';
import { toast } from 'sonner';

describe('OfflineContext', () => {
  const mockMutationFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as ReturnType<typeof vi.fn>).mockReturnValue(mockMutationFn);
    (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getQueuedCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <OfflineProvider>{children}</OfflineProvider>
  );

  describe('useOffline', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useOffline());
      }).toThrow('useOffline must be used within an OfflineProvider');

      consoleSpy.mockRestore();
    });

    it('should return initial context values', async () => {
      const { result } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current).toEqual({
          isOnline: true,
          queuedCount: 0,
          isSyncing: false,
          syncQueue: expect.any(Function),
        });
      });
    });

    it('should reflect online status from useOnlineStatus', async () => {
      (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const { result } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });
    });

    it('should update queuedCount on mount', async () => {
      (getQueuedCount as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const { result } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current.queuedCount).toBe(5);
      });
    });
  });

  describe('syncQueue', () => {
    it('should not sync when offline', async () => {
      (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (getQueuedCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const { result } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current.queuedCount).toBe(1);
      });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(getQueuedMutations).not.toHaveBeenCalled();
    });

    it('should not sync when already syncing', async () => {
      (getQueuedMutations as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useOffline(), { wrapper });

      // Start first sync
      act(() => {
        result.current.syncQueue();
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true);
      });

      // Try second sync - should be ignored
      await act(async () => {
        await result.current.syncQueue();
      });

      expect(getQueuedMutations).toHaveBeenCalledTimes(1);
    });

    it('should return early when queue is empty', async () => {
      (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useOffline(), { wrapper });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(mockMutationFn).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should sync queued mutations successfully', async () => {
      const queuedMutations = [
        {
          id: 'mut-1',
          functionName: 'sessions.start',
          args: { type: 'regular' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue(queuedMutations);
      (getQueuedCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      mockMutationFn.mockResolvedValue('result');

      const { result } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current.queuedCount).toBe(1);
      });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(mockMutationFn).toHaveBeenCalled();
      expect(removeMutation).toHaveBeenCalledWith('mut-1');
      expect(toast.success).toHaveBeenCalledWith('Berhasil menyinkronkan 1 operasi offline');
    });

    it('should handle failed mutation sync with retry', async () => {
      const queuedMutations = [
        {
          id: 'mut-1',
          functionName: 'sessions.start',
          args: { type: 'regular' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue(queuedMutations);
      mockMutationFn.mockRejectedValue(new Error('Sync failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOffline(), { wrapper });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(updateMutationRetryCount).toHaveBeenCalledWith('mut-1', 1);
      expect(toast.error).toHaveBeenCalledWith(
        'Gagal menyinkronkan 1 operasi, akan dicoba lagi'
      );

      consoleSpy.mockRestore();
    });

    it('should remove mutation after max retries exceeded', async () => {
      const queuedMutations = [
        {
          id: 'mut-1',
          functionName: 'sessions.start',
          args: { type: 'regular' },
          timestamp: Date.now(),
          retryCount: 3, // Already at max
        },
      ];

      (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue(queuedMutations);
      mockMutationFn.mockRejectedValue(new Error('Sync failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOffline(), { wrapper });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(removeMutation).toHaveBeenCalledWith('mut-1');
      expect(updateMutationRetryCount).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle unknown mutation function', async () => {
      const queuedMutations = [
        {
          id: 'mut-1',
          functionName: 'unknown.function',
          args: {},
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue(queuedMutations);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOffline(), { wrapper });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync mutation'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should sync multiple mutations and report results', async () => {
      const queuedMutations = [
        {
          id: 'mut-1',
          functionName: 'sessions.start',
          args: { type: 'regular' },
          timestamp: Date.now(),
          retryCount: 0,
        },
        {
          id: 'mut-2',
          functionName: 'sessions.complete',
          args: { duration: 1800 },
          timestamp: Date.now() + 1,
          retryCount: 0,
        },
        {
          id: 'mut-3',
          functionName: 'preferences.save',
          args: { goal: 300 },
          timestamp: Date.now() + 2,
          retryCount: 0,
        },
      ];

      (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue(queuedMutations);
      mockMutationFn
        .mockResolvedValueOnce('result1')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('result3');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOffline(), { wrapper });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(removeMutation).toHaveBeenCalledWith('mut-1');
      expect(removeMutation).toHaveBeenCalledWith('mut-3');
      expect(updateMutationRetryCount).toHaveBeenCalledWith('mut-2', 1);
      expect(toast.success).toHaveBeenCalledWith('Berhasil menyinkronkan 2 operasi offline');
      expect(toast.error).toHaveBeenCalledWith(
        'Gagal menyinkronkan 1 operasi, akan dicoba lagi'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('auto-sync on online', () => {
    it('should auto-sync when coming back online with queued items', async () => {
      (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (getQueuedCount as ReturnType<typeof vi.fn>).mockResolvedValue(2);
      (getQueuedMutations as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'mut-1',
          functionName: 'sessions.start',
          args: { type: 'regular' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ]);
      mockMutationFn.mockResolvedValue('result');

      const { result, rerender } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current.queuedCount).toBe(2);
      });

      // Go online
      (useOnlineStatus as ReturnType<typeof vi.fn>).mockReturnValue(true);
      rerender();

      await waitFor(() => {
        expect(getQueuedMutations).toHaveBeenCalled();
      });
    });
  });

  describe('storage event listener', () => {
    it('should refresh queued count on storage event', async () => {
      (getQueuedCount as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3);

      const { result } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current.queuedCount).toBe(0);
      });

      // Trigger storage event
      act(() => {
        window.dispatchEvent(new Event('storage'));
      });

      await waitFor(() => {
        expect(result.current.queuedCount).toBe(3);
      });
    });
  });

  describe('error handling', () => {
    it('should handle getQueuedCount error gracefully', async () => {
      (getQueuedCount as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOffline(), { wrapper });

      await waitFor(() => {
        expect(result.current.queuedCount).toBe(0);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get queued count:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle syncQueue error gracefully', async () => {
      (getQueuedMutations as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Sync error')
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useOffline(), { wrapper });

      await act(async () => {
        await result.current.syncQueue();
      });

      expect(toast.error).toHaveBeenCalledWith('Gagal menyinkronkan data offline');
      expect(result.current.isSyncing).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
