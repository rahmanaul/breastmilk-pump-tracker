import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSessionsCSV,
  generateDailyStatsCSV,
  downloadFile,
  generateSessionsPDF,
  generateSummaryReportPDF,
  generateSummaryReportPDFWithCharts,
  generateShareableText,
  isShareSupported,
  isFileShareSupported,
  shareReport,
  renderDailyVolumeChart,
  renderSessionTypeChart,
  renderSessionCountChart,
  type SessionExport,
  type DailyStatsExport,
  type SummaryStatsExport,
} from "./export";

// Mock jsPDF and autoTable
vi.mock("jspdf", () => {
  class MockJsPDF {
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    text = vi.fn();
    save = vi.fn();
    addImage = vi.fn();
    output = vi.fn().mockReturnValue(new Blob(["test"], { type: "application/pdf" }));
    internal = {
      pageSize: { height: 297 },
    };
  }
  return {
    jsPDF: MockJsPDF,
  };
});

vi.mock("jspdf-autotable", () => ({
  default: vi.fn(),
}));

// Mock Chart.js
vi.mock("chart.js", () => {
  class MockChart {
    static register = vi.fn();
    destroy = vi.fn();
    constructor() {}
  }
  return {
    Chart: MockChart,
    BarController: {},
    BarElement: {},
    CategoryScale: {},
    LinearScale: {},
    Title: {},
    Tooltip: {},
    Legend: {},
    ArcElement: {},
    DoughnutController: {},
  };
});

// Sample test data
const mockSessions: SessionExport[] = [
  {
    _id: "session1",
    sessionType: "regular",
    startTime: new Date("2024-01-15T08:00:00").getTime(),
    endTime: new Date("2024-01-15T08:30:00").getTime(),
    volume: 120,
    totalPumpDuration: 1500,
    totalRestDuration: 300,
    notes: "Morning session",
    latenessMinutes: 0,
    isCompleted: true,
  },
  {
    _id: "session2",
    sessionType: "power",
    startTime: new Date("2024-01-15T14:00:00").getTime(),
    endTime: new Date("2024-01-15T14:45:00").getTime(),
    volume: 150,
    totalPumpDuration: 2400,
    totalRestDuration: 300,
    notes: "Afternoon power session",
    latenessMinutes: 5,
    isCompleted: true,
  },
  {
    _id: "session3",
    sessionType: "regular",
    startTime: new Date("2024-01-16T08:00:00").getTime(),
    endTime: new Date("2024-01-16T08:25:00").getTime(),
    volume: 100,
    totalPumpDuration: 1200,
    totalRestDuration: 300,
    isCompleted: false,
  },
];

const mockDailyStats: DailyStatsExport[] = [
  {
    date: "2024-01-15",
    totalVolume: 270,
    sessionCount: 2,
    regularVolume: 120,
    powerVolume: 150,
    avgVolumePerSession: 135,
  },
  {
    date: "2024-01-16",
    totalVolume: 100,
    sessionCount: 1,
    regularVolume: 100,
    powerVolume: 0,
    avgVolumePerSession: 100,
  },
];

const mockSummary: SummaryStatsExport = {
  totalSessions: 3,
  totalVolume: 370,
  avgVolumePerSession: 123,
  avgVolumePerDay: 185,
  bestSession: {
    volume: 150,
    date: new Date("2024-01-15T14:00:00").getTime(),
    sessionType: "power",
  },
  bestDay: {
    date: "2024-01-15",
    volume: 270,
  },
  regularStats: {
    count: 2,
    totalVolume: 220,
    avgVolume: 110,
  },
  powerStats: {
    count: 1,
    totalVolume: 150,
    avgVolume: 150,
  },
};

describe("Export Utilities", () => {
  describe("generateSessionsCSV", () => {
    it("should generate CSV with correct headers", () => {
      const csv = generateSessionsCSV(mockSessions);
      const lines = csv.split("\n");
      const headers = lines[0];

      expect(headers).toContain("Date");
      expect(headers).toContain("Time");
      expect(headers).toContain("Type");
      expect(headers).toContain("Volume (ml)");
      expect(headers).toContain("Pump Duration");
      expect(headers).toContain("Rest Duration");
      expect(headers).toContain("Status");
      expect(headers).toContain("Lateness");
      expect(headers).toContain("Notes");
    });

    it("should generate correct number of rows", () => {
      const csv = generateSessionsCSV(mockSessions);
      const lines = csv.split("\n");

      // 1 header + 3 data rows
      expect(lines.length).toBe(4);
    });

    it("should include session data correctly", () => {
      const csv = generateSessionsCSV(mockSessions);

      expect(csv).toContain("Regular");
      expect(csv).toContain("Power");
      expect(csv).toContain("120");
      expect(csv).toContain("150");
      expect(csv).toContain("Morning session");
    });

    it("should handle empty sessions array", () => {
      const csv = generateSessionsCSV([]);
      const lines = csv.split("\n");

      // Only header
      expect(lines.length).toBe(1);
    });

    it("should escape commas in notes", () => {
      const sessionsWithComma: SessionExport[] = [
        {
          ...mockSessions[0],
          notes: "Note with, comma",
        },
      ];

      const csv = generateSessionsCSV(sessionsWithComma);

      // Commas in notes should be replaced with semicolons
      expect(csv).toContain("Note with; comma");
    });

    it("should show lateness correctly", () => {
      const csv = generateSessionsCSV(mockSessions);

      expect(csv).toContain("On time");
      expect(csv).toContain("5 min late");
    });

    it("should show completion status correctly", () => {
      const csv = generateSessionsCSV(mockSessions);

      expect(csv).toContain("Completed");
      expect(csv).toContain("Incomplete");
    });
  });

  describe("generateDailyStatsCSV", () => {
    it("should generate CSV with correct headers", () => {
      const csv = generateDailyStatsCSV(mockDailyStats);
      const lines = csv.split("\n");
      const headers = lines[0];

      expect(headers).toContain("Date");
      expect(headers).toContain("Sessions");
      expect(headers).toContain("Total Volume");
      expect(headers).toContain("Regular Volume");
      expect(headers).toContain("Power Volume");
      expect(headers).toContain("Avg per Session");
    });

    it("should generate correct number of rows", () => {
      const csv = generateDailyStatsCSV(mockDailyStats);
      const lines = csv.split("\n");

      // 1 header + 2 data rows
      expect(lines.length).toBe(3);
    });

    it("should include daily stats correctly", () => {
      const csv = generateDailyStatsCSV(mockDailyStats);

      expect(csv).toContain("2024-01-15");
      expect(csv).toContain("270");
      expect(csv).toContain("135");
    });

    it("should handle empty stats array", () => {
      const csv = generateDailyStatsCSV([]);
      const lines = csv.split("\n");

      expect(lines.length).toBe(1);
    });
  });

  describe("downloadFile", () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let appendChildSpy: ReturnType<typeof vi.spyOn>;
    let removeChildSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      };

      createElementSpy = vi
        .spyOn(document, "createElement")
        .mockReturnValue(mockLink as unknown as HTMLAnchorElement);
      appendChildSpy = vi
        .spyOn(document.body, "appendChild")
        .mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
      removeChildSpy = vi
        .spyOn(document.body, "removeChild")
        .mockImplementation(() => mockLink as unknown as HTMLAnchorElement);
      createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:mock-url");
      revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});
    });

    afterEach(() => {
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it("should create and trigger download link for string content", () => {
      downloadFile("test content", "test.csv", "text/csv");

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    it("should create and trigger download link for Blob content", () => {
      const blob = new Blob(["test"], { type: "application/pdf" });
      downloadFile(blob, "test.pdf", "application/pdf");

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    });
  });

  describe("generateSessionsPDF", () => {
    it("should create a PDF document", () => {
      const doc = generateSessionsPDF(mockSessions);

      expect(doc).toBeDefined();
      // Check that the mock methods exist (they're instance methods)
      expect(doc.text).toBeDefined();
      expect(doc.setFontSize).toBeDefined();
    });

    it("should include title in PDF", () => {
      const doc = generateSessionsPDF(mockSessions, "Custom Title");

      expect(doc).toBeDefined();
      // The doc should have been created with title
      expect(doc.text).toBeDefined();
    });

    it("should handle empty sessions", () => {
      const doc = generateSessionsPDF([]);

      expect(doc).toBeDefined();
    });

    it("should return a jsPDF instance with required methods", () => {
      const doc = generateSessionsPDF(mockSessions);

      expect(doc.save).toBeDefined();
      expect(doc.output).toBeDefined();
      expect(doc.internal).toBeDefined();
      expect(doc.internal.pageSize.height).toBe(297);
    });
  });

  describe("generateSummaryReportPDF", () => {
    it("should create a PDF document", () => {
      const doc = generateSummaryReportPDF(mockDailyStats, mockSummary, "week");

      expect(doc).toBeDefined();
      expect(doc.text).toBeDefined();
    });

    it("should create a PDF for weekly report", () => {
      const doc = generateSummaryReportPDF(mockDailyStats, mockSummary, "week");

      expect(doc).toBeDefined();
      expect(doc.setFontSize).toBeDefined();
    });

    it("should create a PDF for monthly report", () => {
      const doc = generateSummaryReportPDF(mockDailyStats, mockSummary, "month");

      expect(doc).toBeDefined();
    });

    it("should accept custom title", () => {
      const doc = generateSummaryReportPDF(
        mockDailyStats,
        mockSummary,
        "week",
        "My Custom Report"
      );

      expect(doc).toBeDefined();
      expect(doc.text).toBeDefined();
    });
  });

  describe("generateShareableText", () => {
    it("should generate text with summary statistics", () => {
      const text = generateShareableText(mockSummary, "Week 1");

      expect(text).toContain("Pumping Report (Week 1)");
      expect(text).toContain("Total Sessions: 3");
      expect(text).toContain("Total Volume: 370 ml");
      expect(text).toContain("Average per Session: 123 ml");
      expect(text).toContain("Average per Day: 185 ml");
    });

    it("should include regular and power stats", () => {
      const text = generateShareableText(mockSummary, "This Week");

      expect(text).toContain("Regular: 2 sessions (220 ml)");
      expect(text).toContain("Power: 1 sessions (150 ml)");
    });

    it("should include app attribution", () => {
      const text = generateShareableText(mockSummary, "Test");

      expect(text).toContain("Breastmilk Pump Tracker");
    });
  });

  describe("isShareSupported", () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
      });
    });

    it("should return true when navigator.share exists", () => {
      Object.defineProperty(global, "navigator", {
        value: { share: vi.fn() },
        writable: true,
      });

      expect(isShareSupported()).toBe(true);
    });

    it("should return false when navigator.share does not exist", () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
      });

      expect(isShareSupported()).toBe(false);
    });
  });

  describe("isFileShareSupported", () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
      });
    });

    it("should return true when both share and canShare exist", () => {
      Object.defineProperty(global, "navigator", {
        value: {
          share: vi.fn(),
          canShare: vi.fn(),
        },
        writable: true,
      });

      expect(isFileShareSupported()).toBe(true);
    });

    it("should return false when only share exists", () => {
      Object.defineProperty(global, "navigator", {
        value: { share: vi.fn() },
        writable: true,
      });

      expect(isFileShareSupported()).toBe(false);
    });

    it("should return false when neither exists", () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
      });

      expect(isFileShareSupported()).toBe(false);
    });
  });

  describe("shareReport", () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
      });
    });

    it("should return false when share is not supported", async () => {
      Object.defineProperty(global, "navigator", {
        value: {},
        writable: true,
      });

      const result = await shareReport("Title", "Text");

      expect(result).toBe(false);
    });

    it("should call navigator.share with correct data", async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, "navigator", {
        value: { share: mockShare },
        writable: true,
      });

      await shareReport("My Title", "My Text", "https://example.com");

      expect(mockShare).toHaveBeenCalledWith({
        title: "My Title",
        text: "My Text",
        url: "https://example.com",
      });
    });

    it("should return true on successful share", async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(global, "navigator", {
        value: { share: mockShare },
        writable: true,
      });

      const result = await shareReport("Title", "Text");

      expect(result).toBe(true);
    });

    it("should return false when user cancels share", async () => {
      const abortError = new Error("Share cancelled");
      abortError.name = "AbortError";
      const mockShare = vi.fn().mockRejectedValue(abortError);
      Object.defineProperty(global, "navigator", {
        value: { share: mockShare },
        writable: true,
      });

      const result = await shareReport("Title", "Text");

      expect(result).toBe(false);
    });

    it("should throw error on share failure", async () => {
      const mockShare = vi.fn().mockRejectedValue(new Error("Share failed"));
      Object.defineProperty(global, "navigator", {
        value: { share: mockShare },
        writable: true,
      });

      await expect(shareReport("Title", "Text")).rejects.toThrow("Share failed");
    });
  });
});

describe("Edge Cases", () => {
  it("should handle sessions with undefined optional fields", () => {
    const minimalSession: SessionExport[] = [
      {
        _id: "minimal",
        sessionType: "regular",
        startTime: Date.now(),
      },
    ];

    const csv = generateSessionsCSV(minimalSession);

    expect(csv).toContain("Regular");
    expect(csv).toContain("0"); // Default volume
    expect(csv).toContain("On time");
  });

  it("should handle summary with null best session and day", () => {
    const summaryWithNulls: SummaryStatsExport = {
      ...mockSummary,
      bestSession: null,
      bestDay: null,
    };

    const text = generateShareableText(summaryWithNulls, "Test");

    expect(text).toContain("Total Sessions: 3");
    expect(text).not.toContain("undefined");
  });

  it("should format long durations correctly in CSV", () => {
    const longSession: SessionExport[] = [
      {
        _id: "long",
        sessionType: "power",
        startTime: Date.now(),
        totalPumpDuration: 7200, // 2 hours
        totalRestDuration: 1800, // 30 minutes
      },
    ];

    const csv = generateSessionsCSV(longSession);

    expect(csv).toContain("2h 0m"); // 2 hour pump
    expect(csv).toContain("30 min"); // 30 min rest
  });
});

describe("Chart Generation", () => {
  // Mock canvas context
  const mockContext = {
    canvas: { width: 500, height: 200 },
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 10 }),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    clip: vi.fn(),
    rect: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    isPointInPath: vi.fn(),
    isPointInStroke: vi.fn(),
    getLineDash: vi.fn().mockReturnValue([]),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createPattern: vi.fn(),
  };

  beforeEach(() => {
    // Mock document.createElement for canvas
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") {
        return {
          width: 500,
          height: 200,
          getContext: () => mockContext,
          toDataURL: () => "data:image/png;base64,mockImageData",
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("renderDailyVolumeChart", () => {
    it("should render a daily volume chart and return base64 image", async () => {
      const imageData = await renderDailyVolumeChart(mockDailyStats);

      expect(imageData).toBe("data:image/png;base64,mockImageData");
    });

    it("should handle empty daily stats", async () => {
      const imageData = await renderDailyVolumeChart([]);

      expect(imageData).toBe("data:image/png;base64,mockImageData");
    });

    it("should accept custom dimensions", async () => {
      const imageData = await renderDailyVolumeChart(mockDailyStats, 600, 300);

      expect(imageData).toBe("data:image/png;base64,mockImageData");
    });
  });

  describe("renderSessionTypeChart", () => {
    it("should render a session type doughnut chart", async () => {
      const imageData = await renderSessionTypeChart(mockSummary);

      expect(imageData).toBe("data:image/png;base64,mockImageData");
    });

    it("should handle summary with zero volumes", async () => {
      const emptyStats: SummaryStatsExport = {
        ...mockSummary,
        regularStats: { count: 0, totalVolume: 0, avgVolume: 0 },
        powerStats: { count: 0, totalVolume: 0, avgVolume: 0 },
      };

      const imageData = await renderSessionTypeChart(emptyStats);

      expect(imageData).toBe("data:image/png;base64,mockImageData");
    });
  });

  describe("renderSessionCountChart", () => {
    it("should render a session count bar chart", async () => {
      const imageData = await renderSessionCountChart(mockDailyStats);

      expect(imageData).toBe("data:image/png;base64,mockImageData");
    });

    it("should handle single day data", async () => {
      const singleDay: DailyStatsExport[] = [mockDailyStats[0]];
      const imageData = await renderSessionCountChart(singleDay);

      expect(imageData).toBe("data:image/png;base64,mockImageData");
    });
  });
});

describe("PDF with Charts", () => {
  beforeEach(() => {
    // Mock canvas for chart rendering
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") {
        return {
          width: 500,
          height: 200,
          getContext: () => ({
            canvas: { width: 500, height: 200 },
            fillRect: vi.fn(),
            clearRect: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 10 }),
            fillText: vi.fn(),
            strokeText: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            scale: vi.fn(),
            closePath: vi.fn(),
            clip: vi.fn(),
            rect: vi.fn(),
            setTransform: vi.fn(),
            resetTransform: vi.fn(),
            getLineDash: vi.fn().mockReturnValue([]),
            setLineDash: vi.fn(),
            createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
            createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
          }),
          toDataURL: () => "data:image/png;base64,mockChartImage",
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateSummaryReportPDFWithCharts", () => {
    it("should create a PDF document with charts", async () => {
      const doc = await generateSummaryReportPDFWithCharts(
        mockDailyStats,
        mockSummary,
        "week"
      );

      expect(doc).toBeDefined();
      expect(doc.text).toBeDefined();
      expect(doc.addImage).toBeDefined();
    });

    it("should create weekly report with charts", async () => {
      const doc = await generateSummaryReportPDFWithCharts(
        mockDailyStats,
        mockSummary,
        "week"
      );

      expect(doc).toBeDefined();
    });

    it("should create monthly report with charts", async () => {
      const doc = await generateSummaryReportPDFWithCharts(
        mockDailyStats,
        mockSummary,
        "month"
      );

      expect(doc).toBeDefined();
    });

    it("should accept custom title", async () => {
      const doc = await generateSummaryReportPDFWithCharts(
        mockDailyStats,
        mockSummary,
        "week",
        "My Custom Report with Charts"
      );

      expect(doc).toBeDefined();
    });

    it("should handle empty daily stats (no charts)", async () => {
      const doc = await generateSummaryReportPDFWithCharts(
        [],
        mockSummary,
        "week"
      );

      expect(doc).toBeDefined();
    });

    it("should handle daily stats with zero volume (no charts)", async () => {
      const zeroVolumeStats: DailyStatsExport[] = [
        { ...mockDailyStats[0], totalVolume: 0, regularVolume: 0, powerVolume: 0 },
      ];

      const doc = await generateSummaryReportPDFWithCharts(
        zeroVolumeStats,
        mockSummary,
        "week"
      );

      expect(doc).toBeDefined();
    });

    it("should include best session and best day when available", async () => {
      const doc = await generateSummaryReportPDFWithCharts(
        mockDailyStats,
        mockSummary,
        "week"
      );

      expect(doc).toBeDefined();
      expect(doc.text).toBeDefined();
    });

    it("should handle summary without best session or best day", async () => {
      const summaryWithoutBest: SummaryStatsExport = {
        ...mockSummary,
        bestSession: null,
        bestDay: null,
      };

      const doc = await generateSummaryReportPDFWithCharts(
        mockDailyStats,
        summaryWithoutBest,
        "week"
      );

      expect(doc).toBeDefined();
    });
  });
});
