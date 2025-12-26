import { memo } from "react";
import { WifiOff, RefreshCw, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/contexts/OfflineContext";
import { Button } from "@/components/ui/button";

export const OfflineIndicator = memo(function OfflineIndicator() {
  const { isOnline, queuedCount, isSyncing, syncQueue } = useOffline();

  // Don't show anything when online and no queued items
  if (isOnline && queuedCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors",
        isOnline
          ? "bg-blue-500 text-white"
          : "bg-yellow-500 text-yellow-900"
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Anda sedang offline</span>
          {queuedCount > 0 && (
            <span className="bg-yellow-700 text-yellow-100 px-2 py-0.5 rounded-full text-xs">
              {queuedCount} operasi tertunda
            </span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Menyinkronkan data...</span>
        </>
      ) : queuedCount > 0 ? (
        <>
          <Cloud className="h-4 w-4" />
          <span>{queuedCount} operasi perlu disinkronkan</span>
          <Button
            size="sm"
            variant="secondary"
            className="h-6 text-xs"
            onClick={() => syncQueue()}
          >
            Sinkronkan
          </Button>
        </>
      ) : null}
    </div>
  );
});
