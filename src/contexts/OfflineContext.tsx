import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getQueuedMutations,
  removeMutation,
  updateMutationRetryCount,
  getQueuedCount,
  type QueuedMutation,
} from "@/lib/offlineQueue";

const MAX_RETRIES = 3;

interface OfflineContextValue {
  isOnline: boolean;
  queuedCount: number;
  isSyncing: boolean;
  syncQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get mutation functions for syncing
  const startSession = useMutation(api.sessions.start);
  const completeSession = useMutation(api.sessions.complete);
  const switchInterval = useMutation(api.sessions.switchInterval);
  const cancelSession = useMutation(api.sessions.cancelCurrent);
  const deleteSession = useMutation(api.sessions.remove);
  const savePreferences = useMutation(api.preferences.save);
  const updateSchedule = useMutation(api.preferences.updateSchedule);
  const updateDefaults = useMutation(api.preferences.updateDefaults);
  const updateAlertVolume = useMutation(api.preferences.updateAlertVolume);

  // Execute a queued mutation
  const executeMutation = useCallback(
    async (functionName: string, args: Record<string, unknown>): Promise<void> => {
      switch (functionName) {
        case "sessions.start":
          await startSession(args as Parameters<typeof startSession>[0]);
          break;
        case "sessions.complete":
          await completeSession(args as Parameters<typeof completeSession>[0]);
          break;
        case "sessions.switchInterval":
          await switchInterval(args as Parameters<typeof switchInterval>[0]);
          break;
        case "sessions.cancelCurrent":
          await cancelSession();
          break;
        case "sessions.remove":
          await deleteSession(args as Parameters<typeof deleteSession>[0]);
          break;
        case "preferences.save":
          await savePreferences(args as Parameters<typeof savePreferences>[0]);
          break;
        case "preferences.updateSchedule":
          await updateSchedule(args as Parameters<typeof updateSchedule>[0]);
          break;
        case "preferences.updateDefaults":
          await updateDefaults(args as Parameters<typeof updateDefaults>[0]);
          break;
        case "preferences.updateAlertVolume":
          await updateAlertVolume(args as Parameters<typeof updateAlertVolume>[0]);
          break;
        default:
          throw new Error(`Unknown mutation function: ${functionName}`);
      }
    },
    [
      startSession,
      completeSession,
      switchInterval,
      cancelSession,
      deleteSession,
      savePreferences,
      updateSchedule,
      updateDefaults,
      updateAlertVolume,
    ]
  );

  // Update queued count
  const refreshQueuedCount = useCallback(async () => {
    try {
      const count = await getQueuedCount();
      setQueuedCount(count);
    } catch (error) {
      console.error("Failed to get queued count:", error);
    }
  }, []);

  // Sync a single mutation
  const syncMutation = useCallback(
    async (mutation: QueuedMutation): Promise<boolean> => {
      try {
        await executeMutation(mutation.functionName, mutation.args);
        await removeMutation(mutation.id);
        return true;
      } catch (error) {
        console.error(`Failed to sync mutation ${mutation.functionName}:`, error);

        if (mutation.retryCount >= MAX_RETRIES) {
          console.error(`Max retries exceeded for mutation ${mutation.id}, removing from queue`);
          await removeMutation(mutation.id);
          return true;
        }

        await updateMutationRetryCount(mutation.id, mutation.retryCount + 1);
        return false;
      }
    },
    [executeMutation]
  );

  // Sync all queued mutations
  const syncQueue = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const mutations = await getQueuedMutations();
      if (mutations.length === 0) {
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const mutation of mutations) {
        const success = await syncMutation(mutation);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      await refreshQueuedCount();

      if (successCount > 0) {
        toast.success(`Berhasil menyinkronkan ${successCount} operasi offline`);
      }
      if (failCount > 0) {
        toast.error(`Gagal menyinkronkan ${failCount} operasi, akan dicoba lagi`);
      }
    } catch (error) {
      console.error("Failed to sync queue:", error);
      toast.error("Gagal menyinkronkan data offline");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, syncMutation, refreshQueuedCount]);

  // Initial load of queued count
  useEffect(() => {
    refreshQueuedCount();
  }, [refreshQueuedCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queuedCount > 0) {
      syncQueue();
    }
  }, [isOnline, queuedCount, syncQueue]);

  // Listen for queue updates
  useEffect(() => {
    const handleStorageChange = () => {
      refreshQueuedCount();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshQueuedCount]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        queuedCount,
        isSyncing,
        syncQueue,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
