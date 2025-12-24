import { useEffect, useRef } from "react";

interface ScheduleItem {
  time: string; // "HH:mm" format
  enabled: boolean;
}

interface UseScheduleNotificationsOptions {
  schedule: ScheduleItem[] | undefined;
  enabled: boolean;
}

export function useScheduleNotifications({
  schedule,
  enabled,
}: UseScheduleNotificationsOptions) {
  const lastNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !schedule || schedule.length === 0) {
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const checkSchedule = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      // Find if any enabled session matches the current time
      const matchingSession = schedule.find(
        (session) => session.enabled && session.time === currentTime
      );

      if (matchingSession && lastNotifiedRef.current !== currentTime) {
        // Send notification
        const notification = new Notification("Pumping Time!", {
          body: `It's ${formatTime(matchingSession.time)} - time for your pumping session.`,
          icon: "/favicon.ico",
          tag: "pump-reminder",
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Mark as notified for this minute
        lastNotifiedRef.current = currentTime;
      }

      // Reset lastNotified when minute changes
      if (lastNotifiedRef.current && lastNotifiedRef.current !== currentTime) {
        // Only reset if we're past the notified time
        const [lastH, lastM] = lastNotifiedRef.current.split(":").map(Number);
        const [currH, currM] = currentTime.split(":").map(Number);
        const lastMinutes = lastH * 60 + lastM;
        const currMinutes = currH * 60 + currM;

        if (currMinutes !== lastMinutes) {
          lastNotifiedRef.current = null;
        }
      }
    };

    // Check immediately
    checkSchedule();

    // Check every 30 seconds
    const interval = setInterval(checkSchedule, 30000);

    return () => clearInterval(interval);
  }, [schedule, enabled]);
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}
