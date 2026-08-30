// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_META,
  __resetMetaCache,
  markExported,
  parseMeta,
  setRegister,
  toggleRegister,
} from "@/lib/meta";

const KEY = "loglog:meta:v1";

beforeEach(() => {
  window.localStorage.clear();
  __resetMetaCache();
});

afterEach(() => {
  window.localStorage.clear();
  __resetMetaCache();
});

describe("parseMeta", () => {
  it("falls back to the default register with nothing stored", () => {
    expect(parseMeta(null)).toEqual(EMPTY_META);
  });

  it("survives unparseable JSON and non-objects", () => {
    expect(parseMeta("{not json")).toEqual(EMPTY_META);
    expect(parseMeta('"a string"')).toEqual(EMPTY_META);
    expect(parseMeta("null")).toEqual(EMPTY_META);
  });

  it("reads a stored register", () => {
    expect(parseMeta(JSON.stringify({ register: "lab", exportedAt: null })).register).toBe("lab");
  });

  it("rejects an unknown register without discarding the rest", () => {
    const stamp = "2026-05-20T09:00:00.000Z";
    const meta = parseMeta(JSON.stringify({ register: "wizard", exportedAt: stamp }));
    expect(meta.register).toBe("field");
    expect(meta.exportedAt).toBe(stamp);
  });

  it("rejects a junk timestamp without discarding the register", () => {
    const meta = parseMeta(JSON.stringify({ register: "lab", exportedAt: "whenever" }));
    expect(meta.register).toBe("lab");
    expect(meta.exportedAt).toBeNull();
  });
});

describe("the register", () => {
  it("round-trips through storage", () => {
    setRegister("lab");
    expect(parseMeta(window.localStorage.getItem(KEY)).register).toBe("lab");
    setRegister("field");
    expect(parseMeta(window.localStorage.getItem(KEY)).register).toBe("field");
  });

  it("toggles between the two registers and reports where it landed", () => {
    expect(toggleRegister()).toBe("lab");
    expect(toggleRegister()).toBe("field");
  });
});

describe("markExported", () => {
  it("records the first export", () => {
    markExported(new Date("2026-05-20T09:00:00.000Z"));
    expect(parseMeta(window.localStorage.getItem(KEY)).exportedAt).toBe("2026-05-20T09:00:00.000Z");
  });

  it("leaves the original timestamp alone on later exports", () => {
    markExported(new Date("2026-05-20T09:00:00.000Z"));
    markExported(new Date("2026-08-01T09:00:00.000Z"));
    expect(parseMeta(window.localStorage.getItem(KEY)).exportedAt).toBe("2026-05-20T09:00:00.000Z");
  });

  it("does not disturb the register", () => {
    setRegister("lab");
    markExported();
    expect(parseMeta(window.localStorage.getItem(KEY)).register).toBe("lab");
  });
});
