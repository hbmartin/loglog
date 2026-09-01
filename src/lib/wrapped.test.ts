import { describe, expect, it, vi } from "vitest";
import { hourLabel, loggedYears, wrapUp } from "@/lib/wrapped";
import type { Dog, PoopColor, PoopFlag, PoopLog, Store } from "@/lib/types";

function dog(id: string, name: string): Dog {
  return { id, name, createdAt: new Date(2026, 0, 1).toISOString() };
}

function log(
  id: string,
  date: Date,
  score: PoopLog["score"],
  {
    dogId = "d1",
    color = null,
    flags = [],
  }: {
    dogId?: string;
    color?: PoopColor | null;
    flags?: PoopFlag[];
  } = {},
): PoopLog {
  return { id, dogId, score, color, flags, loggedAt: date.toISOString() };
}

/** Local dates throughout: the summary is about the user's calendar. */
const at = (month: number, day: number, hour = 9, year = 2026) =>
  new Date(year, month, day, hour, 0, 0, 0);

function store(logs: PoopLog[], dogs: Dog[] = [dog("d1", "Ada")]): Store {
  return { version: 1, dogs, logs };
}

describe("loggedYears", () => {
  it("lists years with logs, newest first, without duplicates", () => {
    const s = store([
      log("a", at(1, 3, 9, 2025), 2),
      log("b", at(4, 9, 9, 2026), 2),
      log("c", at(7, 1, 9, 2025), 2),
    ]);
    expect(loggedYears(s)).toEqual([2026, 2025]);
  });

  it("skips unparseable timestamps", () => {
    const s = store([{ ...log("bad", at(1, 1), 2), loggedAt: "not-a-date" }]);
    expect(loggedYears(s)).toEqual([]);
  });
});

describe("wrapUp", () => {
  it("returns an empty summary for a year with nothing in it", () => {
    const summary = wrapUp(store([log("a", at(1, 3, 9, 2025), 2)]), 2026);
    expect(summary.total).toBe(0);
    expect(summary.average).toBeNull();
    expect(summary.topScore).toBeNull();
    expect(summary.topColor).toBeNull();
    expect(summary.idealShare).toBe(0);
    expect(summary.perDog).toEqual([]);
  });

  it("counts only the year asked for", () => {
    const s = store([
      log("in", at(2, 2), 2),
      log("also", at(9, 9), 4),
      log("before", at(11, 30, 9, 2025), 7),
    ]);
    const summary = wrapUp(s, 2026);
    expect(summary.total).toBe(2);
    expect(summary.average).toBe(3);
  });

  it("reports the share inside the ideal band", () => {
    const s = store([log("a", at(1, 1), 2), log("b", at(1, 2), 3), log("c", at(1, 3), 7)]);
    expect(wrapUp(s, 2026).idealShare).toBeCloseTo(2 / 3);
  });

  it("finds the most frequent score, color, hour and day", () => {
    const s = store([
      log("a", at(3, 4, 7), 5, { color: "yellow" }),
      log("b", at(3, 4, 7), 5, { color: "yellow" }),
      log("c", at(3, 4, 18), 2, { color: "brown" }),
      log("d", at(6, 1, 7), 5, { color: "yellow" }),
    ]);
    const summary = wrapUp(s, 2026);
    expect(summary.topScore).toEqual({ value: 5, count: 3 });
    expect(summary.topColor).toEqual({ value: "yellow", count: 3 });
    expect(summary.busiestHour).toEqual({ value: 7, count: 3 });
    expect(summary.busiestDay).toEqual({ value: "2026-04-04", count: 3 });
  });

  it("counts active days rather than logs", () => {
    const s = store([log("a", at(3, 4, 7), 2), log("b", at(3, 4, 19), 2), log("c", at(3, 5), 2)]);
    const summary = wrapUp(s, 2026);
    expect(summary.total).toBe(3);
    expect(summary.activeDays).toBe(2);
  });

  it("measures the streak against the same end of year the active days use", () => {
    // A device whose clock ran ahead - or a record edited by hand - dates a
    // log later today. activeDays is measured against the end of the year and
    // counts the day it falls on; longestIdealRun, left to its Date.now()
    // default, read the same entry as the future and refused it. The summary
    // then reported an active day the streak beside it would not count.
    vi.useFakeTimers();
    vi.setSystemTime(at(5, 15, 12));
    const s = store([log("a", at(5, 15, 18), 3)]);

    const summary = wrapUp(s, 2026);
    expect(summary.activeDays).toBe(1);
    expect(summary.longestIdealRun).toBe(1);

    vi.useRealTimers();
  });

  it("counts entries carrying any finding", () => {
    const s = store([
      log("a", at(2, 1), 6, { flags: ["mucus"] }),
      log("b", at(2, 2), 7, { flags: ["blood", "worms"] }),
      log("c", at(2, 3), 2),
    ]);
    expect(wrapUp(s, 2026).flagged).toBe(2);
  });

  it("breaks the per-dog table down and orders it by volume", () => {
    const dogs = [dog("d1", "Ada"), dog("d2", "Bo"), dog("d3", "Never logged")];
    const s = store(
      [
        log("a", at(1, 1), 2, { dogId: "d1" }),
        log("b", at(1, 2), 4, { dogId: "d1" }),
        log("c", at(1, 3), 3, { dogId: "d2" }),
      ],
      dogs,
    );
    const summary = wrapUp(s, 2026);
    expect(summary.dogs).toBe(2);
    expect(summary.perDog.map((entry) => entry.dog.name)).toEqual(["Ada", "Bo"]);
    expect(summary.perDog[0].average).toBe(3);
  });
});

describe("hourLabel", () => {
  it("reads as a clock, not a 24-hour count", () => {
    expect(hourLabel(0)).toBe("12am");
    expect(hourLabel(7)).toBe("7am");
    expect(hourLabel(12)).toBe("12pm");
    expect(hourLabel(23)).toBe("11pm");
  });
});
