import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomInterval {
  id: string;
  type: "pump" | "rest";
  duration: number; // seconds
}

interface IntervalBuilderProps {
  intervals: CustomInterval[];
  onChange: (intervals: CustomInterval[]) => void;
  maxIntervals?: number;
}

// Duration options in minutes
const PUMP_DURATIONS = [5, 10, 15, 20, 25, 30];
const REST_DURATIONS = [3, 5, 10, 15];

// Generate a unique ID
function generateId(): string {
  return `interval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function IntervalBuilder({
  intervals,
  onChange,
  maxIntervals = 10,
}: IntervalBuilderProps) {
  const handleTypeChange = (index: number, type: "pump" | "rest") => {
    const newIntervals = [...intervals];
    const currentDuration = newIntervals[index].duration / 60; // convert to minutes

    // Adjust duration if it's not valid for the new type
    const validDurations = type === "pump" ? PUMP_DURATIONS : REST_DURATIONS;
    const newDuration = validDurations.includes(currentDuration)
      ? currentDuration
      : validDurations[Math.floor(validDurations.length / 2)]; // Pick middle value

    newIntervals[index] = {
      ...newIntervals[index],
      type,
      duration: newDuration * 60,
    };
    onChange(newIntervals);
  };

  const handleDurationChange = (index: number, minutes: number) => {
    const newIntervals = [...intervals];
    newIntervals[index] = {
      ...newIntervals[index],
      duration: minutes * 60,
    };
    onChange(newIntervals);
  };

  const handleAddInterval = () => {
    if (intervals.length >= maxIntervals) return;

    // Smart default: alternate type based on last interval
    const lastInterval = intervals[intervals.length - 1];
    const newType: "pump" | "rest" = lastInterval?.type === "pump" ? "rest" : "pump";
    const defaultDuration = newType === "pump" ? 15 : 5;

    onChange([
      ...intervals,
      {
        id: generateId(),
        type: newType,
        duration: defaultDuration * 60,
      },
    ]);
  };

  const handleRemoveInterval = (index: number) => {
    if (intervals.length <= 1) return;
    const newIntervals = intervals.filter((_, i) => i !== index);
    onChange(newIntervals);
  };

  // Calculate totals
  const totalPumpMinutes = intervals
    .filter((i) => i.type === "pump")
    .reduce((sum, i) => sum + i.duration / 60, 0);
  const totalRestMinutes = intervals
    .filter((i) => i.type === "rest")
    .reduce((sum, i) => sum + i.duration / 60, 0);
  const totalMinutes = totalPumpMinutes + totalRestMinutes;

  // Generate sequence text
  const sequenceText = intervals.map((i) => (i.type === "pump" ? "Pump" : "Rest")).join(" → ");

  return (
    <div className="space-y-3">
      {/* Intervals List */}
      <div className="space-y-2">
        {intervals.map((interval, index) => (
          <Card key={interval.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                {/* Index */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>

                {/* Type Selector */}
                <Select
                  value={interval.type}
                  onValueChange={(value: "pump" | "rest") => handleTypeChange(index, value)}
                >
                  <SelectTrigger className={cn(
                    "w-24",
                    interval.type === "pump"
                      ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
                      : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pump">Pump</SelectItem>
                    <SelectItem value="rest">Rest</SelectItem>
                  </SelectContent>
                </Select>

                {/* Duration Selector */}
                <Select
                  value={(interval.duration / 60).toString()}
                  onValueChange={(value) => handleDurationChange(index, parseInt(value))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(interval.type === "pump" ? PUMP_DURATIONS : REST_DURATIONS).map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {min} menit
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Delete Button */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveInterval(index)}
                  disabled={intervals.length <= 1}
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Button */}
      <Button
        variant="outline"
        onClick={handleAddInterval}
        disabled={intervals.length >= maxIntervals}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Tambah Interval
      </Button>

      {/* Summary */}
      <div className="pt-3 border-t space-y-2">
        {/* Sequence visualization */}
        <p className="text-xs text-muted-foreground text-center">
          {sequenceText}
        </p>

        {/* Time breakdown */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Estimasi total</span>
          <span className="font-medium">~{Math.round(totalMinutes)} menit</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Pump: {Math.round(totalPumpMinutes)} menit</span>
          <span>Rest: {Math.round(totalRestMinutes)} menit</span>
        </div>
      </div>
    </div>
  );
}

// Helper to convert simple mode settings to intervals
export function simpleToIntervals(
  pumpMinutes: number,
  restMinutes: number,
  pumpCount: number
): CustomInterval[] {
  const intervals: CustomInterval[] = [];
  for (let i = 0; i < pumpCount; i++) {
    intervals.push({
      id: generateId(),
      type: "pump",
      duration: pumpMinutes * 60,
    });
    if (i < pumpCount - 1) {
      intervals.push({
        id: generateId(),
        type: "rest",
        duration: restMinutes * 60,
      });
    }
  }
  return intervals;
}

// Helper to generate default intervals
export function getDefaultIntervals(): CustomInterval[] {
  return simpleToIntervals(15, 5, 2);
}
