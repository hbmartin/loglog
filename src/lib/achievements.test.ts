import { describe, expect, it } from "vitest";
import { achievements, longestIdealRun } from "@/lib/achievements";
import type { PoopColor, PoopLog } from "@/lib/types";

// Local calendar days, built the DST-safe way: see the note in trend.test.ts.
const LOCAL_NOON = new Date(2026, 4, 20, 12, 0, 0, 0);

function log(
  id: string,
  daysAgo: number,
  score: PoopLog["score"],
  { hour = 12, color = null }: { hour?: number; color?: PoopColor | null } = {},
): PoopLog {
  const at = new Date(LOCAL_NOON);
  at.setDate(at.getDate() - daysAgo);
  at.setHours(hour, 0, 0, 0);
  return { id, dogId: "d1", score, color, flags: [], loggedAt: at.toISOString() };
}

function find(items: ReturnType<typeof achievements>, id: string) {
  const item = items.find((entry) => entry.id === id);
  if (item === undefined) {
    throw new Error(`no achievement ${id}`);
  }
  return item;
}

describe("longestIdealRun", () => {
  it("is zero with no logs", () => {
    expect(longestIdealRun([])).toBe(0);
  });

  it("counts consecutive days on which everything was ideal", () => {
    const logs = [log("a", 0, 2), log("b", 1, 3), log("c", 2, 2)];
    expect(longestIdealRun(logs)).toBe(3);
  });

  it("spoils a whole day with one off-ideal log on it", () => {
    const logs = [
      log("a", 0, 2),
      log("b", 1, 2, { hour: 8 }),
      log("spoiler", 1, 6, { hour: 19 }),
      log("c", 2, 2),
    ];
    // Day 1 is spoiled, so the best run is a single day either side of it.
    expect(longestIdealRun(logs)).toBe(1);
  });

  it("breaks the run on a day with nothing logged at all", () => {
    const logs = [log("a", 0, 2), log("b", 1, 2), log("gap", 3, 2), log("d", 4, 2)];
    expect(longestIdealRun(logs)).toBe(2);
  });

  it("reports the best run, not the most recent one", () => {
    const logs = [
      log("recent", 0, 2),
      log("old1", 5, 2),
      log("old2", 6, 2),
      log("old3", 7, 2),
      log("old4", 8, 2),
    ];
    expect(longestIdealRun(logs)).toBe(4);
  });

  it("ignores an unparseable timestamp rather than throwing", () => {
    const broken: PoopLog = { ...log("bad", 0, 2), loggedAt: "not-a-date" };
    expect(longestIdealRun([broken, log("a", 1, 2)])).toBe(1);
  });
});

describe("achievements", () => {
  it("locks everything for an empty record", () => {
    expect(achievements([]).every((item) => !item.earned)).toBe(true);
  });

  it("earns The Namesake on a 3 and Code Brown on a 7", () => {
    const items = achievements([log("a", 0, 3), log("b", 1, 7)]);
    expect(find(items, "namesake").earned).toBe(true);
    expect(find(items, "code-brown").earned).toBe(true);
  });

  it("earns Dawn Patrol only before 6am", () => {
    expect(find(achievements([log("a", 0, 2, { hour: 7 })]), "dawn-patrol").earned).toBe(false);
    expect(find(achievements([log("b", 0, 2, { hour: 5 })]), "dawn-patrol").earned).toBe(true);
  });

  it("tracks Full Spectrum across distinct colors only", () => {
    const repeats = achievements([
      log("a", 0, 2, { color: "brown" }),
      log("b", 1, 2, { color: "brown" }),
    ]);
    expect(find(repeats, "full-spectrum").progress.current).toBe(1);

    const all = achievements(
      (["brown", "dark", "black", "red", "yellow", "green", "grey"] as const).map((color, index) =>
        log(`c${index}`, index, 2, { color }),
      ),
    );
    expect(find(all, "full-spectrum").earned).toBe(true);
  });

  it("takes Statistician from the export flag, not the logs", () => {
    expect(find(achievements([log("a", 0, 2)]), "statistician").earned).toBe(false);
    expect(find(achievements([], { exported: true }), "statistician").earned).toBe(true);
  });

  it("caps progress at the goal so a bar can never overrun", () => {
    const many = Array.from({ length: 140 }, (_, index) => log(`n${index}`, index, 2));
    const century = find(achievements(many), "century");
    expect(century.earned).toBe(true);
    expect(century.progress.current).toBe(century.progress.goal);
  });

  it("goes back to locked when the qualifying log is deleted", () => {
    const withSeven = achievements([log("a", 0, 7)]);
    expect(find(withSeven, "code-brown").earned).toBe(true);
    expect(find(achievements([]), "code-brown").earned).toBe(false);
  });
});
