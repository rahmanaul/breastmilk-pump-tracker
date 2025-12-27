import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type ColorScheme = "default" | "rose" | "blue" | "green" | "orange";

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  setTheme: (theme: Theme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  effectiveTheme: "light" | "dark"; // Resolved theme based on system preference
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = "pump-tracker-theme";
const COLOR_SCHEME_STORAGE_KEY = "pump-tracker-color-scheme";

// Color scheme CSS variable overrides
const colorSchemes: Record<ColorScheme, { light: Record<string, string>; dark: Record<string, string> }> = {
  default: { light: {}, dark: {} },
  rose: {
    light: {
      "--primary": "oklch(0.55 0.2 350)",
      "--primary-foreground": "oklch(0.985 0 0)",
      "--chart-1": "oklch(0.55 0.2 350)",
    },
    dark: {
      "--primary": "oklch(0.75 0.15 350)",
      "--primary-foreground": "oklch(0.145 0 0)",
      "--chart-1": "oklch(0.75 0.15 350)",
    },
  },
  blue: {
    light: {
      "--primary": "oklch(0.55 0.2 250)",
      "--primary-foreground": "oklch(0.985 0 0)",
      "--chart-1": "oklch(0.55 0.2 250)",
    },
    dark: {
      "--primary": "oklch(0.75 0.15 250)",
      "--primary-foreground": "oklch(0.145 0 0)",
      "--chart-1": "oklch(0.75 0.15 250)",
    },
  },
  green: {
    light: {
      "--primary": "oklch(0.55 0.2 150)",
      "--primary-foreground": "oklch(0.985 0 0)",
      "--chart-1": "oklch(0.55 0.2 150)",
    },
    dark: {
      "--primary": "oklch(0.75 0.15 150)",
      "--primary-foreground": "oklch(0.145 0 0)",
      "--chart-1": "oklch(0.75 0.15 150)",
    },
  },
  orange: {
    light: {
      "--primary": "oklch(0.65 0.2 50)",
      "--primary-foreground": "oklch(0.985 0 0)",
      "--chart-1": "oklch(0.65 0.2 50)",
    },
    dark: {
      "--primary": "oklch(0.75 0.15 50)",
      "--primary-foreground": "oklch(0.145 0 0)",
      "--chart-1": "oklch(0.75 0.15 50)",
    },
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || "system";
    }
    return "system";
  });

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(COLOR_SCHEME_STORAGE_KEY) as ColorScheme) || "default";
    }
    return "default";
  });

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  // Calculate effective theme based on system preference
  useEffect(() => {
    const updateEffectiveTheme = () => {
      if (theme === "system") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setEffectiveTheme(isDark ? "dark" : "light");
      } else {
        setEffectiveTheme(theme);
      }
    };

    updateEffectiveTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateEffectiveTheme);
    return () => mediaQuery.removeEventListener("change", updateEffectiveTheme);
  }, [theme]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  // Apply color scheme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const schemeVars = colorSchemes[colorScheme][effectiveTheme];

    // Remove previous custom variables by resetting to empty
    Object.keys(colorSchemes.rose.light).forEach((key) => {
      root.style.removeProperty(key);
    });

    // Apply new color scheme variables
    Object.entries(schemeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [colorScheme, effectiveTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, colorScheme, setTheme, setColorScheme, effectiveTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
