import { useSyncExternalStore } from "react";
import { z } from "zod";
import { compareTime } from "@/lib/trend";
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
  createdAt: z.iso.datetime(),
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
  loggedAt: z.iso.datetime(),
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

function mutate(update: (current: Store) => Store): void {
  // Rebase every mutation on the latest persisted snapshot. This prevents a
  // tab with a stale in-memory cache from restoring records another tab added
  // or deleted before its storage event was delivered.
  const current =
    typeof window === "undefined" ? read() : parseStore(window.localStorage.getItem(STORAGE_KEY));
  write(update(current));
}

/**
 * Another tab wrote to the same key: drop the cache, then tell everyone.
 *
 * One handler for the whole module rather than one per subscriber. Both halves
 * of that matter. Invalidating once, before any listener runs, is what leaves
 * the first read to re-parse and every later one to hit the cache it filled; a
 * handler per subscriber nulled the cache again after that read, so each extra
 * subscriber cost another full JSON.parse and schema check of the entire log
 * list, and handed useSyncExternalStore a new object identity for data that
 * had not changed - an extra render on top of the extra parse. And notifying
 * every listener from the one handler is what keeps a foreign write and a
 * local one the same event: write() below fans out the same way.
 */
function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY || event.key === null) {
    cache = null;
    for (const listener of listeners) {
      listener();
    }
  }
}

/**
 * Run `listener` on every write to the store, this tab's and another tab's
 * both. Exported because useStore is not the only thing that has to hear one:
 * useNow steps its reading on a write too, which is what keeps the clock ahead
 * of every record the store holds - see clock.ts.
 */
export function subscribeToStore(listener: () => void): () => void {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useStore(): Store {
  return useSyncExternalStore(subscribeToStore, read, () => EMPTY_STORE);
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
  mutate((current) => ({ ...current, dogs: [...current.dogs, dog] }));
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
  mutate((current) => ({ ...current, logs: [...current.logs, log] }));
  return log;
}

export function deleteLog(id: string): void {
  mutate((current) => ({
    ...current,
    logs: current.logs.filter((log) => log.id !== id),
  }));
}

/** Newest first. */
export function logsForDog(store: Store, dogId: string): PoopLog[] {
  // filter() already returns a fresh array, so sorting it in place mutates
  // nothing shared. toSorted would need Safari 16.4; the floor here is 16.0.
  return store.logs
    .filter((log) => log.dogId === dogId)
    .sort((a, b) => compareTime(b.loggedAt, a.loggedAt));
}

/**
 * Every dog's logs, indexed in a single pass. Calling logsForDog once per dog
 * rescans the whole log list each time; on a list screen that is O(dogs x
 * logs) of filtering and sorting per render.
 *
 * Grouped in store order rather than sorted. What the list screen wants from
 * each dog is one entry - the newest - and newestLog below finds it in a
 * single scan; sorting a thousand-log history to read element [0] is work
 * nothing asked for. A caller that needs the whole ordering has logsForDog.
 *
 * Only dogs with at least one log appear as keys.
 */
export function logsByDog(store: Store): Map<string, PoopLog[]> {
  const grouped = new Map<string, PoopLog[]>();
  for (const log of store.logs) {
    const existing = grouped.get(log.dogId);
    if (existing === undefined) {
      grouped.set(log.dogId, [log]);
    } else {
      existing.push(log);
    }
  }
  return grouped;
}

/**
 * The most recent entry, or undefined for a dog with nothing logged.
 *
 * Ties keep the earlier one in store order, which is what logsForDog's stable
 * sort does too - the two must not disagree about which log is "latest".
 *
 * Compared as instants rather than as strings, for the reason compareTime
 * gives; parsed once per log rather than once per comparison, because this
 * runs over a dog's whole history on the list screen.
 */
export function newestLog(logs: readonly PoopLog[] | undefined): PoopLog | undefined {
  let newest: PoopLog | undefined;
  // A datable timestamp always beats this, so an undatable one can only ever
  // win by default.
  let newestAt = Number.NEGATIVE_INFINITY;
  for (const log of logs ?? []) {
    const at = Date.parse(log.loggedAt);
    if (Number.isNaN(at)) {
      // Sorted oldest by compareTime, so this is the newest of nothing but a
      // history with no datable entry in it at all. Returning it anyway is
      // what keeps the two agreeing, and what keeps the list screen from
      // telling somebody with a record on file that they have logged nothing.
      newest ??= log;
      continue;
    }
    if (at > newestAt) {
      newest = log;
      newestAt = at;
    }
  }
  return newest;
}

/**
 * The raw persisted string, for the error screen's backup download. Bypasses
 * the schema entirely: it exists precisely for the case where the store no
 * longer parses, which is when a backup matters most.
 */
export function exportRawBackup(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function findDog(store: Store, dogId: string): Dog | undefined {
  return store.dogs.find((dog) => dog.id === dogId);
}

/** Test seam: reset module state between cases. */
export function __resetCache(): void {
  cache = null;
}

/**
 * Test seam: how many subscribers the store would notify on a write.
 *
 * A leaked subscription is invisible from the outside - React does not
 * re-render an unmounted tree, so a hook that forgot to unsubscribe sets state
 * into the void and every assertion on what it returned still passes. This is
 * the only place the leak is observable.
 */
export function __listenerCount(): number {
  return listeners.size;
}
