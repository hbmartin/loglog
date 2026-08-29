import { describe, expect, it } from "vitest";
import { parseStore } from "@/lib/storage";
import { EMPTY_STORE } from "@/lib/types";

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
