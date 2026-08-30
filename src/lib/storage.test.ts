import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetCache,
  addDog,
  addLog,
  deleteLog,
  logsByDog,
  logsForDog,
  parseStore,
} from "@/lib/storage";
import { EMPTY_STORE, type PoopLog, type Store } from "@/lib/types";

function poopLog(id: string, dogId: string, loggedAt: string): PoopLog {
  return { id, dogId, score: 3, color: null, flags: [], loggedAt };
}

afterEach(() => {
  __resetCache();
  vi.unstubAllGlobals();
});

describe("parseStore", () => {
  it("returns an empty store when nothing is persisted", () => {
    expect(parseStore(null)).toEqual(EMPTY_STORE);
  });

  it("falls back rather than throwing on malformed JSON", () => {
    expect(parseStore("{not json")).toEqual(EMPTY_STORE);
  });

  it("rejects a payload of the wrong shape", () => {
    expect(parseStore(JSON.stringify({ version: 1, dogs: "nope", logs: [] }))).toEqual(EMPTY_STORE);
  });

  it("rejects a future schema version rather than misreading it", () => {
    expect(parseStore(JSON.stringify({ version: 2, dogs: [], logs: [] }))).toEqual(EMPTY_STORE);
  });

  it("rejects a log with an out-of-range score", () => {
    const raw = JSON.stringify({
      version: 1,
      dogs: [],
      logs: [
        {
          id: "l1",
          dogId: "d1",
          score: 9,
          color: null,
          flags: [],
          loggedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(parseStore(raw)).toEqual(EMPTY_STORE);
  });

  it("rejects invalid dog and log timestamps", () => {
    const validTimestamp = new Date().toISOString();
    const validStore: Store = {
      version: 1,
      dogs: [{ id: "d1", name: "Rex", createdAt: validTimestamp }],
      logs: [
        {
          id: "l1",
          dogId: "d1",
          score: 3,
          color: null,
          flags: [],
          loggedAt: validTimestamp,
        },
      ],
    };

    expect(
      parseStore(
        JSON.stringify({
          ...validStore,
          dogs: [{ ...validStore.dogs[0], createdAt: "yesterday" }],
        }),
      ),
    ).toEqual(EMPTY_STORE);
    expect(
      parseStore(
        JSON.stringify({
          ...validStore,
          logs: [{ ...validStore.logs[0], loggedAt: "eventually" }],
        }),
      ),
    ).toEqual(EMPTY_STORE);
    expect(parseStore(JSON.stringify(validStore))).toEqual(validStore);
  });

  it("round-trips a valid store", () => {
    const store = {
      version: 1 as const,
      dogs: [{ id: "d1", name: "Rex", createdAt: "2026-01-01T00:00:00.000Z" }],
      logs: [
        {
          id: "l1",
          dogId: "d1",
          score: 3 as const,
          color: "brown" as const,
          flags: ["mucus" as const],
          loggedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    };
    expect(parseStore(JSON.stringify(store))).toEqual(store);
  });
});

describe("cross-tab mutations", () => {
  it("rebases additions and deletions on the latest persisted snapshot", () => {
    const key = "loglog:v1";
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => values.set(name, value),
    };
    vi.stubGlobal("window", { localStorage });
    const persisted = () => parseStore(values.get(key) ?? null);
    const persist = (store: Store) => values.set(key, JSON.stringify(store));

    const dog = addDog("Rex")!;
    addLog({
      dogId: dog.id,
      score: 3,
      color: null,
      flags: [],
    });
    const timestamp = new Date().toISOString();
    const externalDog = {
      id: "external-dog",
      name: "Milo",
      createdAt: timestamp,
    };
    const externalLog = {
      id: "external-log",
      dogId: externalDog.id,
      score: 2 as const,
      color: null,
      flags: [],
      loggedAt: timestamp,
    };
    const staleBase = persisted();
    persist({
      ...staleBase,
      dogs: [...staleBase.dogs, externalDog],
      logs: [externalLog],
    });

    addDog("Spot");
    const afterAdd = persisted();
    expect(afterAdd.dogs.map(({ name }) => name)).toEqual(["Rex", "Milo", "Spot"]);
    expect(afterAdd.logs.map(({ id }) => id)).toEqual([externalLog.id]);

    const localLog = addLog({
      dogId: dog.id,
      score: 4,
      color: "brown",
      flags: [],
    });
    const addedInOtherTab = {
      ...externalLog,
      id: "newer-external-log",
    };
    const beforeDelete = persisted();
    expect(beforeDelete.logs.map(({ id }) => id)).toEqual([externalLog.id, localLog.id]);
    persist({ ...beforeDelete, logs: [externalLog, addedInOtherTab] });

    deleteLog(externalLog.id);
    const afterDelete = persisted();
    expect(afterDelete.logs.map(({ id }) => id)).toEqual([addedInOtherTab.id]);
  });
});

describe("logsByDog", () => {
  const store: Store = {
    version: 1,
    dogs: [
      { id: "d1", name: "Rex", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "d2", name: "Bo", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "d3", name: "Nix", createdAt: "2026-01-01T00:00:00.000Z" },
    ],
    logs: [
      poopLog("l1", "d1", "2026-01-02T10:00:00.000Z"),
      poopLog("l2", "d2", "2026-01-05T10:00:00.000Z"),
      poopLog("l3", "d1", "2026-01-09T10:00:00.000Z"),
      poopLog("l4", "d1", "2026-01-04T10:00:00.000Z"),
    ],
  };

  it("groups every log under its own dog", () => {
    const grouped = logsByDog(store);
    expect(grouped.get("d1")).toHaveLength(3);
    expect(grouped.get("d2")).toHaveLength(1);
  });

  it("orders each dog's logs newest first", () => {
    expect(
      logsByDog(store)
        .get("d1")
        ?.map((log) => log.id),
    ).toEqual(["l3", "l4", "l1"]);
  });

  it("omits dogs with no logs rather than storing an empty array", () => {
    expect(logsByDog(store).has("d3")).toBe(false);
  });

  it("agrees with logsForDog", () => {
    expect(logsByDog(store).get("d1")).toEqual(logsForDog(store, "d1"));
  });

  it("returns an empty index for an empty store", () => {
    expect(logsByDog(EMPTY_STORE).size).toBe(0);
  });
});
