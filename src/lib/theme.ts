/**
 * Theme storage, shared by the React provider and by the pre-paint script in
 * index.html that resolves the theme before React mounts. The build
 * substitutes these values into that script (see the loglog:theme-keys plugin
 * in vite.config.ts), so the two copies cannot drift apart.
 */

export type Theme = "dark" | "light" | "system";

export const THEMES = ["dark", "light", "system"] as const;

export const THEME_STORAGE_KEY = "loglog:theme";

/** Pre-1.0 key. Read once so an existing preference survives the rename. */
export const LEGACY_THEME_STORAGE_KEY = "vite-ui-theme";

export function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}
