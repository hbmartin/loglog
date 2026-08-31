import { describe, expect, it } from "vitest";
import { achievements, longestIdealRun } from "@/lib/achievements";
import type { PoopColor, PoopLog } from "@/lib/types";

// Local calendar days, built the DST-safe way: see the note in trend.test.ts.
const LOCAL_NOON = new Date(2026, 4, 20, 12, 0, 0, 0);
const NOW = LOCAL_NOON.getTime();

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

/**
 * Both entry points pinned to the fixture's own clock rather than left to
 * their Date.now() default. Both drop logs dated in the future, so on any
 * machine reading earlier than LOCAL_NOON - a CI runner with a skewed clock, a
 * checkout of an old build, a container with a bad RTC - the default would
 * discard every log below and quietly assert nothing.
 */
function run(logs: readonly PoopLog[]): number {
  return longestIdealRun(logs, NOW);
}

function shelf(logs: readonly PoopLog[], options?: Readonly<{ exported: boolean }>) {
  return achievements(logs, options, NOW);
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
    expect(run([])).toBe(0);
  });

  it("counts consecutive days on which everything was ideal", () => {
    const logs = [log("a", 0, 2), log("b", 1, 3), log("c", 2, 2)];
    expect(run(logs)).toBe(3);
  });

  it("spoils a whole day with one off-ideal log on it", () => {
    const logs = [
      log("a", 0, 2),
      log("b", 1, 2, { hour: 8 }),
      log("spoiler", 1, 6, { hour: 19 }),
      log("c", 2, 2),
    ];
    // Day 1 is spoiled, so the best run is a single day either side of it.
    expect(run(logs)).toBe(1);
  });

  it("breaks the run on a day with nothing logged at all", () => {
    const logs = [log("a", 0, 2), log("b", 1, 2), log("gap", 3, 2), log("d", 4, 2)];
    expect(run(logs)).toBe(2);
  });

  it("reports the best run, not the most recent one", () => {
    const logs = [
      log("recent", 0, 2),
      log("old1", 5, 2),
      log("old2", 6, 2),
      log("old3", 7, 2),
      log("old4", 8, 2),
    ];
    expect(run(logs)).toBe(4);
  });

  it("ignores an unparseable timestamp rather than throwing", () => {
    const broken: PoopLog = { ...log("bad", 0, 2), loggedAt: "not-a-date" };
    expect(run([broken, log("a", 1, 2)])).toBe(1);
  });

  it("does not let a future-dated log extend the run", () => {
    // A clock that ran ahead, or a hand-edited record: tomorrow is ideal in
    // the sense that it has not happened.
    const logs = [log("a", 1, 2), log("b", 0, 2), log("tomorrow", -1, 2)];
    expect(run(logs)).toBe(2);
  });
});

describe("achievements", () => {
  it("locks everything for an empty record", () => {
    expect(shelf([]).every((item) => !item.earned)).toBe(true);
  });

  it("earns The Namesake on a 3 and Code Brown on a 7", () => {
    const items = shelf([log("a", 0, 3), log("b", 1, 7)]);
    expect(find(items, "namesake").earned).toBe(true);
    expect(find(items, "code-brown").earned).toBe(true);
  });

  // The boundary is DAWN_HOUR, shared with timeOfDayNote: any hour that gets
  // the "Dawn patrol." aside on the save confirmation also earns the badge.
  it("earns Dawn Patrol only before 7am", () => {
    expect(find(shelf([log("a", 0, 2, { hour: 7 })]), "dawn-patrol").earned).toBe(false);
    expect(find(shelf([log("b", 0, 2, { hour: 6 })]), "dawn-patrol").earned).toBe(true);
    expect(find(shelf([log("c", 0, 2, { hour: 5 })]), "dawn-patrol").earned).toBe(true);
  });

  it("tracks Full Spectrum across distinct colors only", () => {
    const repeats = shelf([log("a", 0, 2, { color: "brown" }), log("b", 1, 2, { color: "brown" })]);
    expect(find(repeats, "full-spectrum").progress.current).toBe(1);

    const all = shelf(
      (["brown", "dark", "black", "red", "yellow", "green", "grey"] as const).map((color, index) =>
        log(`c${index}`, index, 2, { color }),
      ),
    );
    expect(find(all, "full-spectrum").earned).toBe(true);
  });

  it("takes Statistician from the export flag, not the logs", () => {
    expect(find(shelf([log("a", 0, 2)]), "statistician").earned).toBe(false);
    expect(find(shelf([], { exported: true }), "statistician").earned).toBe(true);
  });

  it("caps progress at the goal so a bar can never overrun", () => {
    const many = Array.from({ length: 140 }, (_, index) => log(`n${index}`, index, 2));
    const century = find(shelf(many), "century");
    expect(century.earned).toBe(true);
    expect(century.progress.current).toBe(century.progress.goal);
  });

  it("scores every milestone on logs that have happened, not just the streak", () => {
    // A record from a device whose clock ran ahead, or one edited by hand -
    // the case the guard inside longestIdealRun was written for. Only Solid
    // Week consulted `now`, so a pair of entries dated a decade out unlocked
    // Code Brown, The Namesake and Dawn Patrol on the spot and counted towards
    // Full Spectrum and Century besides.
    const items = shelf([
      log("ahead", -3650, 7, { hour: 5, color: "red" }),
      log("also ahead", -3650, 3, { color: "green" }),
    ]);
    expect(items.every((item) => !item.earned)).toBe(true);
    expect(find(items, "full-spectrum").progress.current).toBe(0);
    expect(find(items, "century").progress.current).toBe(0);
  });

  it("goes back to locked when the qualifying log is deleted", () => {
    const withSeven = shelf([log("a", 0, 7)]);
    expect(find(withSeven, "code-brown").earned).toBe(true);
    expect(find(shelf([]), "code-brown").earned).toBe(false);
  });
});
