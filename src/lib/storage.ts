import { useSyncExternalStore } from "react";
import { z } from "zod";
import {
  EMPTY_STORE,
  POOP_COLORS,
  POOP_FLAGS,
  type Dog,
  type FecalScore,
  type PoopColor,
  type PoopFlag,
  type PoopLog,
  type Store,
} from "@/lib/types";

const STORAGE_KEY = "loglog:v1";

const dogSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

const logSchema = z.object({
  id: z.string(),
  dogId: z.string(),
  score: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  color: z.enum(POOP_COLORS).nullable(),
  flags: z.array(z.enum(POOP_FLAGS)),
  loggedAt: z.string(),
});

const storeSchema = z.object({
  version: z.literal(1),
  dogs: z.array(dogSchema),
  logs: z.array(logSchema),
});

/**
 * Parse persisted state. localStorage is the only copy of this data, so a
 * corrupt or foreign value must degrade to an empty store rather than
 * white-screening the app.
 */
export function parseStore(raw: string | null): Store {
  if (raw === null) {
    return EMPTY_STORE;
  }
  try {
    const result = storeSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

// Cached snapshot: useSyncExternalStore requires a referentially stable value
// between writes, so we only re-read localStorage when the cache is invalidated.
let cache: Store | null = null;
const listeners = new Set<() => void>();

function read(): Store {
  if (cache === null) {
    cache =
      typeof window === "undefined"
        ? EMPTY_STORE
        : parseStore(window.localStorage.getItem(STORAGE_KEY));
  }
  return cache;
}

function write(next: Store): void {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Safari private mode and full-quota browsers throw here. The in-memory
      // cache still holds the change, so the session keeps working.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab wrote to the same key: drop the cache and re-render.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
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

export function useStore(): Store {
  return useSyncExternalStore(subscribe, read, () => EMPTY_STORE);
}

function newId(): string {
  return crypto.randomUUID();
}

export function addDog(name: string): Dog | null {
  const trimmed = name.trim();
  if (trimmed === "") {
    return null;
  }
  const dog: Dog = {
    id: newId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  const current = read();
  write({ ...current, dogs: [...current.dogs, dog] });
  return dog;
}

export function addLog(input: {
  dogId: string;
  score: FecalScore;
  color: PoopColor | null;
  flags: PoopFlag[];
}): PoopLog {
  const log: PoopLog = {
    id: newId(),
    dogId: input.dogId,
    score: input.score,
    color: input.color,
    flags: input.flags,
    loggedAt: new Date().toISOString(),
  };
  const current = read();
  write({ ...current, logs: [...current.logs, log] });
  return log;
}

export function deleteLog(id: string): void {
  const current = read();
  write({ ...current, logs: current.logs.filter((log) => log.id !== id) });
}

/** Newest first. */
export function logsForDog(store: Store, dogId: string): PoopLog[] {
  return store.logs
    .filter((log) => log.dogId === dogId)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export function findDog(store: Store, dogId: string): Dog | undefined {
  return store.dogs.find((dog) => dog.id === dogId);
}

/** Test seam: reset module state between cases. */
export function __resetCache(): void {
  cache = null;
}
