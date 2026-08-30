import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light" | "system";

const THEMES = ["dark", "light", "system"] as const;

/**
 * Keep in sync with the pre-paint script in index.html, which resolves the
 * theme before React mounts and so cannot import this constant.
 */
export const THEME_STORAGE_KEY = "loglog:theme";

/** Pre-1.0 key. Read once so an existing preference survives the rename. */
const LEGACY_THEME_STORAGE_KEY = "vite-ui-theme";

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) {
      return stored;
    }
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (isTheme(legacy)) {
      window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
      return legacy;
    }
  } catch {
    // Safari private mode denies access; fall back to the default theme.
  }
  return null;
}

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

// No default value: consuming outside the provider is a bug, and useTheme
// below turns it into a real error rather than silently doing nothing.
const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({ children, defaultTheme = "system" }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return defaultTheme;
    }
    return readStoredTheme() ?? defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const apply = (resolved: "dark" | "light") => {
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
    };

    if (theme !== "system") {
      apply(theme);
      return;
    }

    // Follow the OS while it is set to "system", so changing appearance takes
    // effect without a reload.
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => apply(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference will not survive a reload, but the session still switches.
    }
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
