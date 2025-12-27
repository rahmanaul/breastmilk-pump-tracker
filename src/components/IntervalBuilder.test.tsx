import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  IntervalBuilder,
  simpleToIntervals,
  getDefaultIntervals,
  type CustomInterval,
} from "./IntervalBuilder";

describe("IntervalBuilder", () => {
  const defaultIntervals: CustomInterval[] = [
    { id: "1", type: "pump", duration: 900 }, // 15 min
    { id: "2", type: "rest", duration: 300 }, // 5 min
    { id: "3", type: "pump", duration: 900 }, // 15 min
  ];

  describe("rendering", () => {
    it("should render all intervals", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      // Should show 3 interval cards
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should render add interval button", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      expect(screen.getByText("Tambah Interval")).toBeInTheDocument();
    });

    it("should show sequence summary", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      expect(screen.getByText("Pump → Rest → Pump")).toBeInTheDocument();
    });

    it("should show total time estimation", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      // 15 + 5 + 15 = 35 minutes
      expect(screen.getByText("~35 menit")).toBeInTheDocument();
    });

    it("should show pump and rest breakdown", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      expect(screen.getByText("Pump: 30 menit")).toBeInTheDocument();
      expect(screen.getByText("Rest: 5 menit")).toBeInTheDocument();
    });
  });

  describe("adding intervals", () => {
    it("should add interval when button clicked", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      fireEvent.click(screen.getByText("Tambah Interval"));

      expect(onChange).toHaveBeenCalledTimes(1);
      const newIntervals = onChange.mock.calls[0][0];
      expect(newIntervals).toHaveLength(4);
    });

    it("should alternate type when adding (pump after rest, rest after pump)", () => {
      const onChange = vi.fn();
      // Ends with pump, so next should be rest
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      fireEvent.click(screen.getByText("Tambah Interval"));

      const newIntervals = onChange.mock.calls[0][0];
      expect(newIntervals[3].type).toBe("rest");
    });

    it("should add pump after rest", () => {
      const onChange = vi.fn();
      const intervalsEndingWithRest: CustomInterval[] = [
        { id: "1", type: "pump", duration: 900 },
        { id: "2", type: "rest", duration: 300 },
      ];
      render(
        <IntervalBuilder
          intervals={intervalsEndingWithRest}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText("Tambah Interval"));

      const newIntervals = onChange.mock.calls[0][0];
      expect(newIntervals[2].type).toBe("pump");
    });

    it("should disable add button when max intervals reached", () => {
      const onChange = vi.fn();
      const manyIntervals: CustomInterval[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        type: i % 2 === 0 ? "pump" : "rest",
        duration: 300,
      }));

      render(
        <IntervalBuilder
          intervals={manyIntervals}
          onChange={onChange}
          maxIntervals={10}
        />
      );

      const addButton = screen.getByText("Tambah Interval");
      expect(addButton).toBeDisabled();
    });
  });

  describe("removing intervals", () => {
    it("should remove interval when delete clicked", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      // Find delete buttons (there should be 3)
      const deleteButtons = screen.getAllByRole("button", { name: "" }).filter(
        (btn) => btn.querySelector('svg.lucide-trash-2') !== null
      );

      // Click the first delete button
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }

      expect(onChange).toHaveBeenCalledTimes(1);
      const newIntervals = onChange.mock.calls[0][0];
      expect(newIntervals).toHaveLength(2);
    });

    it("should disable delete when only 1 interval remains", () => {
      const onChange = vi.fn();
      const singleInterval: CustomInterval[] = [
        { id: "1", type: "pump", duration: 900 },
      ];

      render(
        <IntervalBuilder intervals={singleInterval} onChange={onChange} />
      );

      // The delete button should be disabled
      const deleteButtons = screen.getAllByRole("button").filter(
        (btn) => btn.querySelector('svg') !== null && (btn as HTMLButtonElement).disabled
      );

      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe("type selection", () => {
    it("should have type selectors for each interval", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      // There should be type selectors showing Pump and Rest
      expect(screen.getAllByText("Pump").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Rest").length).toBeGreaterThan(0);
    });
  });

  describe("duration selection", () => {
    it("should show duration for each interval", () => {
      const onChange = vi.fn();
      render(
        <IntervalBuilder intervals={defaultIntervals} onChange={onChange} />
      );

      // Should show "15 menit" for pump intervals
      expect(screen.getAllByText("15 menit").length).toBe(2);
      // Should show "5 menit" for rest interval
      expect(screen.getAllByText("5 menit").length).toBe(1);
    });
  });
});

describe("simpleToIntervals", () => {
  it("should convert simple mode to intervals array", () => {
    const intervals = simpleToIntervals(15, 5, 2);

    expect(intervals).toHaveLength(3); // pump -> rest -> pump
    expect(intervals[0].type).toBe("pump");
    expect(intervals[0].duration).toBe(900); // 15 * 60
    expect(intervals[1].type).toBe("rest");
    expect(intervals[1].duration).toBe(300); // 5 * 60
    expect(intervals[2].type).toBe("pump");
    expect(intervals[2].duration).toBe(900);
  });

  it("should handle single pump", () => {
    const intervals = simpleToIntervals(20, 10, 1);

    expect(intervals).toHaveLength(1);
    expect(intervals[0].type).toBe("pump");
    expect(intervals[0].duration).toBe(1200); // 20 * 60
  });

  it("should handle 3 pumps", () => {
    const intervals = simpleToIntervals(10, 5, 3);

    // pump -> rest -> pump -> rest -> pump
    expect(intervals).toHaveLength(5);
    expect(intervals[0].type).toBe("pump");
    expect(intervals[1].type).toBe("rest");
    expect(intervals[2].type).toBe("pump");
    expect(intervals[3].type).toBe("rest");
    expect(intervals[4].type).toBe("pump");
  });

  it("should generate unique IDs for each interval", () => {
    const intervals = simpleToIntervals(15, 5, 2);

    const ids = intervals.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(intervals.length);
  });
});

describe("getDefaultIntervals", () => {
  it("should return default intervals (15 min pump, 5 min rest, 2 pumps)", () => {
    const intervals = getDefaultIntervals();

    expect(intervals).toHaveLength(3);
    expect(intervals[0].type).toBe("pump");
    expect(intervals[0].duration).toBe(900); // 15 min
    expect(intervals[1].type).toBe("rest");
    expect(intervals[1].duration).toBe(300); // 5 min
    expect(intervals[2].type).toBe("pump");
    expect(intervals[2].duration).toBe(900);
  });
});
