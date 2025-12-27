import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThemeProvider, useTheme, type Theme, type ColorScheme } from "./ThemeContext";

describe("ThemeContext", () => {
  let mockLocalStorage: Record<string, string>;
  let mockMatchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLocalStorage = {};

    // Mock localStorage
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => mockLocalStorage[key] || null
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        mockLocalStorage[key] = value;
      }
    );

    // Mock matchMedia
    mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? false : true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", mockMatchMedia);

    // Mock document.documentElement
    Object.defineProperty(document.documentElement, "classList", {
      value: {
        remove: vi.fn(),
        add: vi.fn(),
      },
      configurable: true,
    });

    Object.defineProperty(document.documentElement, "style", {
      value: {
        removeProperty: vi.fn(),
        setProperty: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  it("should provide default theme as 'system'", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("system");
  });

  it("should provide default color scheme as 'default'", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.colorScheme).toBe("default");
  });

  it("should change theme when setTheme is called", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(mockLocalStorage["pump-tracker-theme"]).toBe("dark");
  });

  it("should change color scheme when setColorScheme is called", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setColorScheme("rose");
    });

    expect(result.current.colorScheme).toBe("rose");
    expect(mockLocalStorage["pump-tracker-color-scheme"]).toBe("rose");
  });

  it("should resolve effectiveTheme based on theme setting", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    // Default is system, which depends on matchMedia (mocked to prefer-light)
    expect(result.current.effectiveTheme).toBe("light");

    act(() => {
      result.current.setTheme("dark");
    });
    expect(result.current.effectiveTheme).toBe("dark");

    act(() => {
      result.current.setTheme("light");
    });
    expect(result.current.effectiveTheme).toBe("light");
  });

  it("should load theme from localStorage on init", () => {
    mockLocalStorage["pump-tracker-theme"] = "dark";
    mockLocalStorage["pump-tracker-color-scheme"] = "blue";

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("dark");
    expect(result.current.colorScheme).toBe("blue");
  });

  it("should throw error when useTheme is used outside ThemeProvider", () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow("useTheme must be used within a ThemeProvider");
  });

  it("should update document classList when effectiveTheme changes", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(document.documentElement.classList.remove).toHaveBeenCalledWith(
      "light",
      "dark"
    );
    expect(document.documentElement.classList.add).toHaveBeenCalledWith("dark");
  });

  it("should support all theme options", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    const themes: Theme[] = ["light", "dark", "system"];
    themes.forEach((theme) => {
      act(() => {
        result.current.setTheme(theme);
      });
      expect(result.current.theme).toBe(theme);
    });
  });

  it("should support all color scheme options", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    const schemes: ColorScheme[] = ["default", "rose", "blue", "green", "orange"];
    schemes.forEach((scheme) => {
      act(() => {
        result.current.setColorScheme(scheme);
      });
      expect(result.current.colorScheme).toBe(scheme);
    });
  });
});
