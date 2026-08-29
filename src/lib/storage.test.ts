import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetCache,
  addDog,
  addLog,
  deleteLog,
  parseStore,
} from "@/lib/storage";
import { EMPTY_STORE, type Store } from "@/lib/types";

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
    expect(parseStore(JSON.stringify({ version: 1, dogs: "nope", logs: [] }))).toEqual(
      EMPTY_STORE
    );
  });

  it("rejects a future schema version rather than misreading it", () => {
    expect(parseStore(JSON.stringify({ version: 2, dogs: [], logs: [] }))).toEqual(
      EMPTY_STORE
    );
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
        })
      )
    ).toEqual(EMPTY_STORE);
    expect(
      parseStore(
        JSON.stringify({
          ...validStore,
          logs: [{ ...validStore.logs[0], loggedAt: "eventually" }],
        })
      )
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
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
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
    expect(beforeDelete.logs.map(({ id }) => id)).toEqual([
      externalLog.id,
      localLog.id,
    ]);
    persist({ ...beforeDelete, logs: [externalLog, addedInOtherTab] });

    deleteLog(externalLog.id);
    const afterDelete = persisted();
    expect(afterDelete.logs.map(({ id }) => id)).toEqual([addedInOtherTab.id]);
  });
});
