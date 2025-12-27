import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useConfetti } from "./useConfetti";

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(() => Promise.resolve()),
}));

import confetti from "canvas-confetti";

describe("useConfetti", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return fire, burst, and celebration functions", () => {
    const { result } = renderHook(() => useConfetti());

    expect(result.current.fire).toBeDefined();
    expect(typeof result.current.fire).toBe("function");
    expect(result.current.burst).toBeDefined();
    expect(typeof result.current.burst).toBe("function");
    expect(result.current.celebration).toBeDefined();
    expect(typeof result.current.celebration).toBe("function");
  });

  it("fire should call confetti with default options", () => {
    const { result } = renderHook(() => useConfetti());

    result.current.fire();

    expect(confetti).toHaveBeenCalled();
  });

  it("fire should call confetti with custom options", () => {
    const { result } = renderHook(() => useConfetti());

    result.current.fire({
      particleCount: 50,
      spread: 100,
      colors: ["#ff0000"],
    });

    expect(confetti).toHaveBeenCalled();
  });

  it("burst should call confetti with burst configuration", () => {
    const { result } = renderHook(() => useConfetti());

    result.current.burst();

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
      })
    );
  });

  it("burst should accept custom options", () => {
    const { result } = renderHook(() => useConfetti());

    result.current.burst({
      particleCount: 200,
      spread: 120,
      colors: ["#00ff00", "#0000ff"],
    });

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 200,
        spread: 120,
      })
    );
  });

  it("celebration should call confetti multiple times", () => {
    const { result } = renderHook(() => useConfetti());

    result.current.celebration();

    // Initial burst calls confetti twice
    expect(confetti).toHaveBeenCalledTimes(2);

    // Advance timers to trigger delayed bursts
    vi.advanceTimersByTime(100);
    expect(confetti).toHaveBeenCalledTimes(4);

    vi.advanceTimersByTime(100);
    expect(confetti).toHaveBeenCalledTimes(6);

    vi.advanceTimersByTime(100);
    expect(confetti).toHaveBeenCalledTimes(8);
  });

  it("fire should create animation loop", () => {
    const { result } = renderHook(() => useConfetti());
    const mockRequestAnimationFrame = vi.spyOn(window, "requestAnimationFrame");

    result.current.fire({ duration: 1000 });

    // Animation should continue while duration hasn't elapsed
    expect(confetti).toHaveBeenCalled();
    expect(mockRequestAnimationFrame).toHaveBeenCalled();

    mockRequestAnimationFrame.mockRestore();
  });

  it("should maintain stable function references", () => {
    const { result, rerender } = renderHook(() => useConfetti());

    const initialFire = result.current.fire;
    const initialBurst = result.current.burst;
    const initialCelebration = result.current.celebration;

    rerender();

    expect(result.current.fire).toBe(initialFire);
    expect(result.current.burst).toBe(initialBurst);
    expect(result.current.celebration).toBe(initialCelebration);
  });
});
