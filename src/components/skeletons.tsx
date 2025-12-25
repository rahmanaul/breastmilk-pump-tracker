import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ScheduleCardSkeleton() {
  return (
    <Card className="border bg-muted/30">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />

          {/* Time and Type */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>

          {/* Button */}
          <Skeleton className="h-8 w-14 rounded-md shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ScheduleListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ScheduleCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-24" />
      </CardContent>
    </Card>
  );
}

export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}

export function ProgressCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Progress Card */}
      <ProgressCardSkeleton />

      {/* Schedule Section */}
      <div>
        <Skeleton className="h-6 w-32 mb-3" />
        <ScheduleListSkeleton count={4} />
      </div>

      {/* Quick Stats */}
      <StatsGridSkeleton />
    </div>
  );
}

export function HistoryCardSkeleton() {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-6 w-16 ml-auto" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HistoryListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <HistoryCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HistoryPageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Date group */}
      <div>
        <Skeleton className="h-5 w-24 mb-2" />
        <HistoryListSkeleton count={3} />
      </div>

      {/* Another date group */}
      <div>
        <Skeleton className="h-5 w-24 mb-2" />
        <HistoryListSkeleton count={2} />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-48 w-full rounded" />
      </CardContent>
    </Card>
  );
}

export function StatsPageSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <Skeleton className="h-8 w-24" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Chart */}
      <ChartSkeleton />
    </div>
  );
}

export function SettingsFormSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <Skeleton className="h-8 w-24" />

      {/* Form groups */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      {/* Schedule section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <ScheduleListSkeleton count={3} />
      </div>
    </div>
  );
}
