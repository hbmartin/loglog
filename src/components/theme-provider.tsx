import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isTheme, LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/** The stored preference, current key first. Reads only - see migrateLegacyKey. */
function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) {
      return stored;
    }
    // Validated before falling back, so a garbage value under the current key
    // does not hide a real preference under the legacy one.
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (isTheme(legacy)) {
      return legacy;
    }
  } catch {
    // Safari private mode denies access; fall back to the default theme.
  }
  return null;
}

/**
 * Moves a preference still filed under the pre-rename key across, once.
 *
 * Deliberately not folded back into the read above, which runs inside a
 * useState initializer: writing and deleting localStorage keys there is a
 * side effect performed during the render phase. React is free to run an
 * initializer twice (StrictMode) or to start a render and throw it away
 * (concurrent rendering), and a discarded render would still have deleted the
 * legacy key. An effect only runs for a render that actually committed.
 */
function migrateLegacyKey(): void {
  try {
    if (isTheme(window.localStorage.getItem(THEME_STORAGE_KEY))) {
      return;
    }
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (isTheme(legacy)) {
      window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    }
  } catch {
    // Denied storage leaves the legacy key where it is, to be read again next
    // load - which is what happened before any of this existed.
  }
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
    migrateLegacyKey();
  }, []);

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
