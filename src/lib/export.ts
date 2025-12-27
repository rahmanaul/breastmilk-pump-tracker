import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  DoughnutController,
} from "chart.js";

// Register Chart.js components
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  DoughnutController
);

// Session type for export functions
export type SessionExport = {
  _id: string;
  sessionType: "regular" | "power";
  startTime: number;
  endTime?: number;
  volume?: number;
  totalPumpDuration?: number;
  totalRestDuration?: number;
  notes?: string;
  latenessMinutes?: number;
  isCompleted?: boolean;
};

// Daily stats type for export
export type DailyStatsExport = {
  date: string;
  totalVolume: number;
  sessionCount: number;
  regularVolume: number;
  powerVolume: number;
  avgVolumePerSession: number;
};

// Summary stats type for export
export type SummaryStatsExport = {
  totalSessions: number;
  totalVolume: number;
  avgVolumePerSession: number;
  avgVolumePerDay: number;
  bestSession: {
    volume: number;
    date: number;
    sessionType: "regular" | "power";
  } | null;
  bestDay: {
    date: string;
    volume: number;
  } | null;
  regularStats: {
    count: number;
    totalVolume: number;
    avgVolume: number;
  };
  powerStats: {
    count: number;
    totalVolume: number;
    avgVolume: number;
  };
};

// Format duration from seconds to human readable
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// Generate CSV content from sessions
export function generateSessionsCSV(sessions: SessionExport[]): string {
  const headers = [
    "Date",
    "Time",
    "Type",
    "Volume (ml)",
    "Pump Duration",
    "Rest Duration",
    "Total Duration",
    "Status",
    "Lateness",
    "Notes",
  ];

  const rows = sessions.map((session) => {
    const date = new Date(session.startTime);
    const pumpDuration = session.totalPumpDuration || 0;
    const restDuration = session.totalRestDuration || 0;
    const totalDuration = pumpDuration + restDuration;

    return [
      format(date, "yyyy-MM-dd"),
      format(date, "HH:mm"),
      session.sessionType === "regular" ? "Regular" : "Power",
      session.volume?.toString() || "0",
      formatDuration(pumpDuration),
      formatDuration(restDuration),
      formatDuration(totalDuration),
      session.isCompleted !== false ? "Completed" : "Incomplete",
      session.latenessMinutes
        ? `${session.latenessMinutes} min late`
        : "On time",
      session.notes?.replace(/,/g, ";") || "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}

// Generate CSV content from daily stats
export function generateDailyStatsCSV(stats: DailyStatsExport[]): string {
  const headers = [
    "Date",
    "Sessions",
    "Total Volume (ml)",
    "Regular Volume (ml)",
    "Power Volume (ml)",
    "Avg per Session (ml)",
  ];

  const rows = stats.map((day) => [
    day.date,
    day.sessionCount.toString(),
    day.totalVolume.toString(),
    day.regularVolume.toString(),
    day.powerVolume.toString(),
    day.avgVolumePerSession.toString(),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

// Download file helper
export function downloadFile(
  content: string | Blob,
  filename: string,
  type: string
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export sessions to CSV
export function exportSessionsToCSV(
  sessions: SessionExport[],
  filename?: string
): void {
  const csv = generateSessionsCSV(sessions);
  const name =
    filename || `pumping-sessions-${format(new Date(), "yyyy-MM-dd")}.csv`;
  downloadFile(csv, name, "text/csv;charset=utf-8");
}

// Export daily stats to CSV
export function exportDailyStatsToCSV(
  stats: DailyStatsExport[],
  filename?: string
): void {
  const csv = generateDailyStatsCSV(stats);
  const name =
    filename || `pumping-stats-${format(new Date(), "yyyy-MM-dd")}.csv`;
  downloadFile(csv, name, "text/csv;charset=utf-8");
}

// Generate PDF report from sessions
export function generateSessionsPDF(
  sessions: SessionExport[],
  title: string = "Pumping Sessions Report",
  dateRange?: { start: Date; end: Date }
): jsPDF {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text(title, 14, 22);

  // Date range
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (dateRange) {
    doc.text(
      `Period: ${format(dateRange.start, "MMM d, yyyy")} - ${format(dateRange.end, "MMM d, yyyy")}`,
      14,
      30
    );
  } else {
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy HH:mm")}`, 14, 30);
  }

  // Summary section
  const totalVolume = sessions.reduce((sum, s) => sum + (s.volume || 0), 0);
  const avgVolume =
    sessions.length > 0 ? Math.round(totalVolume / sessions.length) : 0;
  const regularCount = sessions.filter(
    (s) => s.sessionType === "regular"
  ).length;
  const powerCount = sessions.filter((s) => s.sessionType === "power").length;

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Summary", 14, 42);

  doc.setFontSize(10);
  doc.text(`Total Sessions: ${sessions.length}`, 14, 50);
  doc.text(`Total Volume: ${totalVolume} ml`, 14, 56);
  doc.text(`Average per Session: ${avgVolume} ml`, 14, 62);
  doc.text(`Regular Sessions: ${regularCount}`, 100, 50);
  doc.text(`Power Sessions: ${powerCount}`, 100, 56);

  // Sessions table
  const tableData = sessions.map((session) => {
    const date = new Date(session.startTime);
    const pumpDuration = session.totalPumpDuration || 0;

    return [
      format(date, "MMM d"),
      format(date, "HH:mm"),
      session.sessionType === "regular" ? "Regular" : "Power",
      `${session.volume || 0} ml`,
      formatDuration(pumpDuration),
      session.isCompleted !== false ? "Yes" : "No",
    ];
  });

  autoTable(doc, {
    startY: 72,
    head: [["Date", "Time", "Type", "Volume", "Duration", "Complete"]],
    body: tableData,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });

  return doc;
}

// Generate weekly/monthly summary PDF report
export function generateSummaryReportPDF(
  dailyStats: DailyStatsExport[],
  summary: SummaryStatsExport,
  periodType: "week" | "month",
  title?: string
): jsPDF {
  const doc = new jsPDF();

  const reportTitle =
    title ||
    `${periodType === "week" ? "Weekly" : "Monthly"} Pumping Report`;

  // Title
  doc.setFontSize(20);
  doc.text(reportTitle, 14, 22);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy")}`, 14, 30);

  // Summary Stats
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Overview", 14, 45);

  doc.setFontSize(10);
  const statsY = 55;

  // Left column
  doc.text(`Total Sessions: ${summary.totalSessions}`, 14, statsY);
  doc.text(`Total Volume: ${summary.totalVolume} ml`, 14, statsY + 8);
  doc.text(`Avg per Session: ${summary.avgVolumePerSession} ml`, 14, statsY + 16);
  doc.text(`Avg per Day: ${summary.avgVolumePerDay} ml`, 14, statsY + 24);

  // Right column
  doc.text(
    `Regular: ${summary.regularStats.count} sessions (${summary.regularStats.totalVolume} ml)`,
    100,
    statsY
  );
  doc.text(
    `Power: ${summary.powerStats.count} sessions (${summary.powerStats.totalVolume} ml)`,
    100,
    statsY + 8
  );
  if (summary.bestSession) {
    doc.text(
      `Best Session: ${summary.bestSession.volume} ml (${format(new Date(summary.bestSession.date), "MMM d")})`,
      100,
      statsY + 16
    );
  }
  if (summary.bestDay) {
    doc.text(
      `Best Day: ${summary.bestDay.volume} ml (${summary.bestDay.date})`,
      100,
      statsY + 24
    );
  }

  // Daily breakdown table
  doc.setFontSize(14);
  doc.text("Daily Breakdown", 14, statsY + 42);

  const tableData = dailyStats.map((day) => [
    day.date,
    day.sessionCount.toString(),
    `${day.totalVolume} ml`,
    `${day.regularVolume} ml`,
    `${day.powerVolume} ml`,
    `${day.avgVolumePerSession} ml`,
  ]);

  autoTable(doc, {
    startY: statsY + 48,
    head: [["Date", "Sessions", "Total", "Regular", "Power", "Avg/Session"]],
    body: tableData,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246], // Blue
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Breastmilk Pump Tracker - For Healthcare Provider Review", 14, pageHeight - 10);

  return doc;
}

// Export sessions to PDF
export function exportSessionsToPDF(
  sessions: SessionExport[],
  title?: string,
  dateRange?: { start: Date; end: Date },
  filename?: string
): void {
  const doc = generateSessionsPDF(sessions, title, dateRange);
  const name =
    filename || `pumping-sessions-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(name);
}

// Export summary report to PDF (without charts - for backward compatibility)
export function exportSummaryReportToPDF(
  dailyStats: DailyStatsExport[],
  summary: SummaryStatsExport,
  periodType: "week" | "month",
  filename?: string
): void {
  const doc = generateSummaryReportPDF(dailyStats, summary, periodType);
  const name =
    filename ||
    `pumping-${periodType}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(name);
}

/**
 * Generate summary report PDF with charts
 * This async version includes visual charts for daily volume and session distribution
 */
export async function generateSummaryReportPDFWithCharts(
  dailyStats: DailyStatsExport[],
  summary: SummaryStatsExport,
  periodType: "week" | "month",
  title?: string
): Promise<jsPDF> {
  const doc = new jsPDF();

  const reportTitle =
    title ||
    `${periodType === "week" ? "Weekly" : "Monthly"} Pumping Report`;

  // Title
  doc.setFontSize(20);
  doc.text(reportTitle, 14, 22);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy")}`, 14, 30);

  // Summary Stats
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Overview", 14, 42);

  doc.setFontSize(10);
  const statsY = 52;

  // Stats in a more compact format
  doc.text(`Total Sessions: ${summary.totalSessions}`, 14, statsY);
  doc.text(`Total Volume: ${summary.totalVolume} ml`, 70, statsY);
  doc.text(`Avg/Session: ${summary.avgVolumePerSession} ml`, 130, statsY);

  doc.text(`Regular: ${summary.regularStats.count} (${summary.regularStats.totalVolume} ml)`, 14, statsY + 8);
  doc.text(`Power: ${summary.powerStats.count} (${summary.powerStats.totalVolume} ml)`, 70, statsY + 8);
  doc.text(`Avg/Day: ${summary.avgVolumePerDay} ml`, 130, statsY + 8);

  // Best achievements
  if (summary.bestSession || summary.bestDay) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    let achievementY = statsY + 18;
    if (summary.bestSession) {
      doc.text(
        `Best Session: ${summary.bestSession.volume} ml on ${format(new Date(summary.bestSession.date), "MMM d")}`,
        14,
        achievementY
      );
      achievementY += 6;
    }
    if (summary.bestDay) {
      doc.text(
        `Best Day: ${summary.bestDay.volume} ml on ${summary.bestDay.date}`,
        14,
        achievementY
      );
    }
  }

  // Generate and add charts
  let chartY = 90;

  // Only render charts if there's data
  if (dailyStats.length > 0 && dailyStats.some(d => d.totalVolume > 0)) {
    // Daily Volume Chart (stacked bar showing regular vs power)
    doc.setFontSize(12);
    doc.setTextColor(0);

    try {
      const volumeChartImage = await renderDailyVolumeChart(dailyStats, 520, 160);
      doc.addImage(volumeChartImage, "PNG", 14, chartY, 180, 55);
      chartY += 60;
    } catch {
      // If chart rendering fails, continue without it
      console.warn("Could not render daily volume chart");
    }

    // Session Type Distribution (doughnut) - positioned next to session count chart
    try {
      const typeChartImage = await renderSessionTypeChart(summary, 200, 200);
      doc.addImage(typeChartImage, "PNG", 14, chartY, 60, 60);
    } catch {
      console.warn("Could not render session type chart");
    }

    // Sessions per Day Chart
    try {
      const sessionChartImage = await renderSessionCountChart(dailyStats, 400, 150);
      doc.addImage(sessionChartImage, "PNG", 80, chartY, 115, 45);
    } catch {
      console.warn("Could not render session count chart");
    }

    chartY += 65;
  }

  // Daily breakdown table
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Daily Breakdown", 14, chartY + 5);

  const tableData = [...dailyStats]
    .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
    .map((day) => [
      format(new Date(day.date), "MMM d, yyyy"),
      day.sessionCount.toString(),
      `${day.totalVolume} ml`,
      `${day.regularVolume} ml`,
      `${day.powerVolume} ml`,
      `${day.avgVolumePerSession} ml`,
    ]);

  autoTable(doc, {
    startY: chartY + 10,
    head: [["Date", "Sessions", "Total", "Regular", "Power", "Avg/Session"]],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    "Breastmilk Pump Tracker - For Healthcare Provider Review",
    14,
    pageHeight - 10
  );

  return doc;
}

/**
 * Export summary report to PDF with charts
 * This is the main export function for stats page
 */
export async function exportSummaryReportWithChartsToPDF(
  dailyStats: DailyStatsExport[],
  summary: SummaryStatsExport,
  periodType: "week" | "month",
  filename?: string
): Promise<void> {
  const doc = await generateSummaryReportPDFWithCharts(
    dailyStats,
    summary,
    periodType
  );
  const name =
    filename ||
    `pumping-${periodType}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(name);
}

// Share report using Web Share API
export async function shareReport(
  title: string,
  text: string,
  url?: string,
  files?: File[]
): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    const shareData: ShareData = { title, text };

    if (url) {
      shareData.url = url;
    }

    if (files && files.length > 0 && navigator.canShare?.({ files })) {
      shareData.files = files;
    }

    await navigator.share(shareData);
    return true;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      // User cancelled sharing
      return false;
    }
    throw error;
  }
}

// Generate shareable text summary
export function generateShareableText(
  summary: SummaryStatsExport,
  periodLabel: string
): string {
  return `Pumping Report (${periodLabel})

Total Sessions: ${summary.totalSessions}
Total Volume: ${summary.totalVolume} ml
Average per Session: ${summary.avgVolumePerSession} ml
Average per Day: ${summary.avgVolumePerDay} ml

Regular: ${summary.regularStats.count} sessions (${summary.regularStats.totalVolume} ml)
Power: ${summary.powerStats.count} sessions (${summary.powerStats.totalVolume} ml)

Generated by Breastmilk Pump Tracker`;
}

// Generate PDF blob for sharing
export async function generatePDFBlob(doc: jsPDF): Promise<Blob> {
  return doc.output("blob");
}

// Create shareable PDF file
export async function createShareablePDFFile(
  doc: jsPDF,
  filename: string
): Promise<File> {
  const blob = await generatePDFBlob(doc);
  return new File([blob], filename, { type: "application/pdf" });
}

// Check if Web Share API is available
export function isShareSupported(): boolean {
  return !!navigator.share;
}

// Check if file sharing is supported
export function isFileShareSupported(): boolean {
  return typeof navigator.share === "function" && typeof navigator.canShare === "function";
}

// Chart generation utilities for PDF export

/**
 * Creates an offscreen canvas for chart rendering
 */
function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Renders a daily volume bar chart and returns as base64 image
 */
export async function renderDailyVolumeChart(
  dailyStats: DailyStatsExport[],
  width: number = 500,
  height: number = 200
): Promise<string> {
  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // Sort by date
  const sortedStats = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedStats.map((d) => format(new Date(d.date), "MMM d")),
      datasets: [
        {
          label: "Regular",
          data: sortedStats.map((d) => d.regularVolume),
          backgroundColor: "rgba(59, 130, 246, 0.8)", // Blue
          borderColor: "rgb(59, 130, 246)",
          borderWidth: 1,
        },
        {
          label: "Power",
          data: sortedStats.map((d) => d.powerVolume),
          backgroundColor: "rgba(245, 158, 11, 0.8)", // Amber
          borderColor: "rgb(245, 158, 11)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 10 },
            padding: 10,
          },
        },
        title: {
          display: true,
          text: "Daily Volume (ml)",
          font: { size: 12, weight: "bold" },
          padding: { bottom: 10 },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 9 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: "ml",
            font: { size: 10 },
          },
          ticks: { font: { size: 9 } },
        },
      },
    },
  });

  // Wait for chart to render
  await new Promise((resolve) => setTimeout(resolve, 100));

  const imageData = canvas.toDataURL("image/png");

  // Destroy chart to free memory
  chart.destroy();

  return imageData;
}

/**
 * Renders a session type distribution doughnut chart and returns as base64 image
 */
export async function renderSessionTypeChart(
  summary: SummaryStatsExport,
  width: number = 200,
  height: number = 200
): Promise<string> {
  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  const chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Regular", "Power"],
      datasets: [
        {
          data: [summary.regularStats.totalVolume, summary.powerStats.totalVolume],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)", // Blue
            "rgba(245, 158, 11, 0.8)", // Amber
          ],
          borderColor: ["rgb(59, 130, 246)", "rgb(245, 158, 11)"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 10 },
            padding: 8,
            generateLabels: (chart) => {
              const data = chart.data;
              if (data.labels && data.datasets.length) {
                const dataset = data.datasets[0];
                const total = (dataset.data as number[]).reduce((a, b) => a + b, 0);
                return (data.labels as string[]).map((label, i) => {
                  const value = dataset.data[i] as number;
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return {
                    text: `${label}: ${value}ml (${percentage}%)`,
                    fillStyle: (dataset.backgroundColor as string[])[i],
                    strokeStyle: (dataset.borderColor as string[])[i],
                    lineWidth: 2,
                    hidden: false,
                    index: i,
                  };
                });
              }
              return [];
            },
          },
        },
        title: {
          display: true,
          text: "Volume by Type",
          font: { size: 12, weight: "bold" },
          padding: { bottom: 5 },
        },
      },
      cutout: "50%",
    },
  });

  // Wait for chart to render
  await new Promise((resolve) => setTimeout(resolve, 100));

  const imageData = canvas.toDataURL("image/png");

  // Destroy chart to free memory
  chart.destroy();

  return imageData;
}

/**
 * Renders a sessions per day bar chart
 */
export async function renderSessionCountChart(
  dailyStats: DailyStatsExport[],
  width: number = 500,
  height: number = 150
): Promise<string> {
  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // Sort by date
  const sortedStats = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedStats.map((d) => format(new Date(d.date), "MMM d")),
      datasets: [
        {
          label: "Sessions",
          data: sortedStats.map((d) => d.sessionCount),
          backgroundColor: "rgba(34, 197, 94, 0.8)", // Green
          borderColor: "rgb(34, 197, 94)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Sessions per Day",
          font: { size: 12, weight: "bold" },
          padding: { bottom: 10 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 } },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { size: 9 },
          },
        },
      },
    },
  });

  // Wait for chart to render
  await new Promise((resolve) => setTimeout(resolve, 100));

  const imageData = canvas.toDataURL("image/png");

  // Destroy chart to free memory
  chart.destroy();

  return imageData;
}
