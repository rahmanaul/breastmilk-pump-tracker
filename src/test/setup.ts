import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Web Audio API
class MockAudioContext {
  state = "running";
  createOscillator() {
    return {
      type: "square",
      frequency: { value: 800 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  close() {
    return Promise.resolve();
  }
}

Object.defineProperty(window, "AudioContext", {
  writable: true,
  value: MockAudioContext,
});

Object.defineProperty(window, "webkitAudioContext", {
  writable: true,
  value: MockAudioContext,
});

// Mock navigator.vibrate
Object.defineProperty(navigator, "vibrate", {
  writable: true,
  value: vi.fn(),
});

// Mock Notification API
Object.defineProperty(window, "Notification", {
  writable: true,
  value: class MockNotification {
    static permission = "granted";
    static requestPermission = vi.fn().mockResolvedValue("granted");
    onclick: (() => void) | null = null;
    constructor(
      public title: string,
      public options?: NotificationOptions
    ) {}
    close = vi.fn();
  },
});
