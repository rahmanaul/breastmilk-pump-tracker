import { useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { useOnlineStatus } from "./useOnlineStatus";
import { queueMutation } from "@/lib/offlineQueue";
import type { FunctionReference } from "convex/server";

type MutationArgs<T extends FunctionReference<"mutation">> = T extends FunctionReference<
  "mutation",
  "public",
  infer Args
>
  ? Args
  : never;

export function useOfflineMutation<T extends FunctionReference<"mutation">>(
  mutation: T,
  functionName: string
) {
  const mutate = useMutation(mutation);
  const isOnline = useOnlineStatus();

  const execute = useCallback(
    async (args: MutationArgs<T>) => {
      if (isOnline) {
        // Online: execute normally
        return mutate(args);
      } else {
        // Offline: queue the mutation
        try {
          const id = await queueMutation(functionName, args as Record<string, unknown>);
          toast.info("Anda sedang offline. Operasi disimpan dan akan disinkronkan saat online.", {
            id: `offline-queue-${id}`,
          });
          return null;
        } catch (error) {
          console.error("Failed to queue mutation:", error);
          toast.error("Gagal menyimpan operasi offline");
          throw error;
        }
      }
    },
    [mutate, isOnline, functionName]
  );

  return execute;
}
