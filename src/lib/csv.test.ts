import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsv, csvFilename, escapeField, toCsv } from "@/lib/csv";
import type { Store } from "@/lib/types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("escapeField", () => {
  it("leaves plain values alone", () => {
    expect(escapeField("Rex")).toBe("Rex");
  });

  it("quotes fields containing a comma, quote or newline", () => {
    expect(escapeField("Rex, the dog")).toBe('"Rex, the dog"');
    expect(escapeField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeField("two\nlines")).toBe('"two\nlines"');
    expect(escapeField("two\rlines")).toBe('"two\rlines"');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(escapeField("=1+1")).toBe("'=1+1");
    expect(escapeField("+cmd")).toBe("'+cmd");
    expect(escapeField("-2")).toBe("'-2");
    expect(escapeField("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("defuses before quoting, so both apply", () => {
    expect(escapeField('=HYPERLINK("a","b")')).toBe('"\'=HYPERLINK(""a"",""b"")"');
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF per RFC 4180", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe("a,b\r\nc,d");
  });
});

const store: Store = {
  version: 1,
  dogs: [
    { id: "d1", name: "Rex", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "d2", name: "Bo", createdAt: "2026-01-01T00:00:00.000Z" },
  ],
  logs: [
    {
      id: "l2",
      dogId: "d1",
      score: 6,
      color: "green",
      flags: ["blood", "mucus"],
      loggedAt: "2026-02-02T10:00:00.000Z",
    },
    {
      id: "l1",
      dogId: "d1",
      score: 2,
      color: null,
      flags: [],
      loggedAt: "2026-01-02T10:00:00.000Z",
    },
    {
      id: "l3",
      dogId: "d2",
      score: 3,
      color: "brown",
      flags: [],
      loggedAt: "2026-03-02T10:00:00.000Z",
    },
  ],
};

describe("buildCsv", () => {
  it("emits a header and one oldest-first row per log", () => {
    const lines = buildCsv(store).split("\r\n");
    expect(lines[0]).toBe("dog,logged_at,score,score_label,color,blood,mucus,worms");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("2026-01-02T10:00:00.000Z");
    expect(lines[3]).toContain("2026-03-02T10:00:00.000Z");
  });

  it("expands flags into per-column yes markers", () => {
    const row = buildCsv(store).split("\r\n")[2];
    expect(row).toBe("Rex,2026-02-02T10:00:00.000Z,6,Shapeless mush,green,yes,yes,");
  });

  it("restricts output to the dogs it is given", () => {
    const lines = buildCsv(store, [store.dogs[1]]).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Bo");
  });
});

describe("csvFilename", () => {
  it("slugs the prefix and dates the file", () => {
    expect(csvFilename("Señor Woofs!")).toMatch(/^se-or-woofs-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("falls back when the prefix slugs to nothing", () => {
    expect(csvFilename("!!!")).toMatch(/^loglog-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("uses the local calendar date instead of the UTC date", () => {
    vi.spyOn(Date.prototype, "getFullYear").mockReturnValue(2026);
    vi.spyOn(Date.prototype, "getMonth").mockReturnValue(0);
    vi.spyOn(Date.prototype, "getDate").mockReturnValue(2);
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-01-03T01:00:00.000Z");

    expect(csvFilename()).toBe("loglog-2026-01-02.csv");
  });
});
