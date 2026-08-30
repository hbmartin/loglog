import { useSyncExternalStore } from "react";
import { isRegister, LEXICONS, type Lexicon, type Register } from "@/lib/lexicon";

/**
 * Small, separate from the log store on purpose.
 *
 * This is interface state - which register the copy is in, whether a CSV has
 * ever been exported - and losing it costs a joke. `loglog:v1` holds the only
 * copy of data a vet might need, so it keeps its schema, its version literal
 * and its migration story to itself rather than growing UI preferences.
 */
const META_KEY = "loglog:meta:v1";

export type Meta = {
  register: Register;
  /** ISO 8601, or null if the user has never exported. Drives one milestone. */
  exportedAt: string | null;
};

export const EMPTY_META: Meta = { register: "field", exportedAt: null };

/**
 * Hand-checked rather than schema-checked. Two fields do not justify pulling
 * zod into the root route's import graph, which is where this module sits -
 * `useLexicon` is called from __root, so anything it imports is on the path to
 * first paint.
 *
 * Every field falls back independently: a garbage `exportedAt` should not also
 * throw away a perfectly good register.
 */
export function parseMeta(raw: string | null): Meta {
  if (raw === null) {
    return EMPTY_META;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return EMPTY_META;
    }
    const record = parsed as Record<string, unknown>;
    const exportedAt = record.exportedAt;
    return {
      register: isRegister(record.register) ? record.register : EMPTY_META.register,
      exportedAt:
        typeof exportedAt === "string" && !Number.isNaN(Date.parse(exportedAt)) ? exportedAt : null,
    };
  } catch {
    return EMPTY_META;
  }
}

let cache: Meta | null = null;
const listeners = new Set<() => void>();

function read(): Meta {
  if (cache === null) {
    cache =
      typeof window === "undefined" ? EMPTY_META : parseMeta(window.localStorage.getItem(META_KEY));
  }
  return cache;
}

function write(next: Meta): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(META_KEY, JSON.stringify(next));
    } catch {
      // Denied storage costs the preference on reload, not the session.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === META_KEY || event.key === null) {
      cache = null;
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useMeta(): Meta {
  return useSyncExternalStore(subscribe, read, () => EMPTY_META);
}

/** The copy for the register currently in force. */
export function useLexicon(): Lexicon {
  return LEXICONS[useMeta().register];
}

export function setRegister(register: Register): void {
  if (!isRegister(register)) {
    return;
  }
  write({ ...read(), register });
}

export function toggleRegister(): Register {
  const next: Register = read().register === "lab" ? "field" : "lab";
  setRegister(next);
  return next;
}

/** Called on every CSV export; only the first one actually changes anything. */
export function markExported(now = new Date()): void {
  const current = read();
  if (current.exportedAt !== null) {
    return;
  }
  write({ ...current, exportedAt: now.toISOString() });
}

/** Test seam: reset module state between cases. */
export function __resetMetaCache(): void {
  cache = null;
}
