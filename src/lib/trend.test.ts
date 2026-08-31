import { describe, expect, it } from "vitest";
import {
  chartSeries,
  compareTime,
  regularity,
  standings,
  summarise,
  timeAgo,
  timeOfDayNote,
  withinDays,
} from "@/lib/trend";
import type { Dog, PoopLog } from "@/lib/types";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function iso(at: number): string {
  return new Date(at).toISOString();
}

function log(daysAgo: number, score: PoopLog["score"]): PoopLog {
  return {
    id: `l${daysAgo}-${score}`,
    dogId: "d1",
    score,
    color: null,
    flags: [],
    loggedAt: new Date(NOW - daysAgo * DAY).toISOString(),
  };
}

describe("summarise", () => {
  it("reports an empty summary with no logs", () => {
    expect(summarise([], NOW)).toEqual({
      total: 0,
      lastWeek: 0,
      average: null,
      offIdeal: 0,
    });
  });

  it("counts all logs but averages only the last 7 days", () => {
    const trend = summarise([log(1, 2), log(3, 4), log(20, 7)], NOW);
    expect(trend.total).toBe(3);
    expect(trend.lastWeek).toBe(2);
    expect(trend.average).toBe(3);
  });

  it("counts recent scores outside the ideal 2-3 band", () => {
    expect(summarise([log(1, 1), log(2, 2), log(3, 3), log(4, 7)], NOW).offIdeal).toBe(2);
  });

  it("excludes off-ideal scores older than a week", () => {
    expect(summarise([log(8, 7)], NOW).offIdeal).toBe(0);
  });

  it("includes the seven-day boundary but excludes future logs", () => {
    const trend = summarise([log(7, 2), log(-1, 7)], NOW);
    expect(trend.lastWeek).toBe(1);
    expect(trend.average).toBe(2);
    expect(trend.offIdeal).toBe(0);
    // The total is counted through the same guard as everything beside it, or
    // the screen claims a history it then refuses to describe.
    expect(trend.total).toBe(1);
  });
});

describe("compareTime", () => {
  it("orders mixed-precision timestamps by the instant, not the text", () => {
    expect(compareTime("2026-03-10T12:00:00Z", "2026-03-10T12:00:00.500Z")).toBeLessThan(0);
  });

  it("sorts an unparseable timestamp oldest rather than nowhere at all", () => {
    // Returning NaN puts it nowhere: sort coerces that to 0, so the entry
    // compares equal to every other one at once and the order stops being
    // transitive - which can leave it at index 0 of a newest-first list, the
    // entry the dog page reads as the latest log.
    expect(compareTime("not-a-date", "2026-03-10T12:00:00Z")).toBeLessThan(0);
    expect(compareTime("2026-03-10T12:00:00Z", "not-a-date")).toBeGreaterThan(0);
    expect(compareTime("not-a-date", "also-not-a-date")).toBe(0);
  });
});

describe("timeAgo", () => {
  it("describes recent times in the largest whole unit", () => {
    expect(timeAgo(new Date(NOW - 30_000).toISOString(), NOW)).toBe("just now");
    expect(timeAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5m ago");
    expect(timeAgo(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3h ago");
    expect(timeAgo(new Date(NOW - 2 * DAY).toISOString(), NOW)).toBe("2d ago");
  });

  it("falls back to a date past a week", () => {
    expect(timeAgo(new Date(NOW - 30 * DAY).toISOString(), NOW)).not.toMatch(/ago/);
  });

  it("does not throw on an unparseable timestamp", () => {
    expect(timeAgo("not-a-date", NOW)).toBe("unknown");
  });
});

describe("chartSeries", () => {
  it("produces no points with no logs", () => {
    expect(chartSeries([], NOW).points).toEqual([]);
  });

  it("drops logs older than the window and logs in the future", () => {
    const series = chartSeries([log(45, 3), log(31, 3), log(29, 3), log(-1, 3)], NOW);
    expect(series.points).toHaveLength(1);
    expect(series.points[0].loggedAt).toBe(log(29, 3).loggedAt);
  });

  it("orders points oldest first regardless of input order", () => {
    const xs = chartSeries([log(1, 3), log(20, 3), log(10, 3)], NOW).points.map((point) => point.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("places the window edges at x 0 and 1", () => {
    const series = chartSeries([log(30, 3), log(0, 3)], NOW);
    expect(series.points[0].x).toBeCloseTo(0);
    expect(series.points[1].x).toBeCloseTo(1);
  });

  it("puts the worst score at the top of the plot and the hardest at the bottom", () => {
    const series = chartSeries([log(2, 7), log(1, 1)], NOW);
    expect(series.points[0].y).toBeCloseTo(0);
    expect(series.points[1].y).toBeCloseTo(1);
  });

  it("flags points outside the ideal 2-3 band", () => {
    const series = chartSeries([log(4, 2), log(3, 3), log(2, 4), log(1, 1)], NOW);
    expect(series.points.map((point) => point.ideal)).toEqual([true, true, false, false]);
  });

  it("pads the band so ideal scores sit inside it, not on its edge", () => {
    const { band } = chartSeries([], NOW);
    const [two, three] = chartSeries([log(2, 2), log(1, 3)], NOW).points;
    expect(band.top).toBeLessThan(three.y);
    expect(band.bottom).toBeGreaterThan(two.y);
  });

  it("spans the whole window with ticks, both ends pinned", () => {
    const { ticks } = chartSeries([], NOW);
    expect(ticks).toHaveLength(5);
    // Not just "close to the edges": the component draws the first label
    // left-aligned and the last right-aligned on the assumption that they sit
    // flush against the plot edges, and a log older than the leftmost tick
    // would plot outside the labelled range.
    expect(ticks[0].x).toBe(0);
    expect(ticks[ticks.length - 1].x).toBe(1);
    const xs = ticks.map((tick) => tick.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("labels the oldest tick with the oldest day in the window", () => {
    const { ticks } = chartSeries([], NOW);
    const thirtyDaysAgo = new Date(NOW - 30 * DAY).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    expect(ticks[0].label).toBe(thirtyDaysAgo);
  });

  it("carries each log's id so a point survives its neighbours being deleted", () => {
    const series = chartSeries([log(3, 2), log(1, 4)], NOW);
    expect(series.points.map((point) => point.id)).toEqual(["l3-2", "l1-4"]);
  });

  it("keeps a single log plottable", () => {
    expect(chartSeries([log(5, 4)], NOW).points).toHaveLength(1);
  });
});

describe("a log dated after `now`", () => {
  // Nothing the app itself writes lands here: useNow steps on the write that
  // saves a score, so the reading every helper below measures against is never
  // behind the store - see clock.ts. What is left ahead of `now` is what these
  // guards exist for, a device whose clock ran ahead or a record imported from
  // one that had, and no window forgives it by so much as a second.
  const ahead: PoopLog = { ...log(0, 2), id: "ahead", loggedAt: iso(NOW + 20_000) };
  const onTheDot: PoopLog = { ...log(0, 2), id: "on the dot", loggedAt: iso(NOW) };

  it("is dropped by the total and the week count alike", () => {
    const trend = summarise([ahead, log(1, 3)], NOW);
    expect(trend.total).toBe(1);
    expect(trend.lastWeek).toBe(1);
  });

  it("is left off the chart and out of the report window", () => {
    expect(chartSeries([ahead], NOW).points).toEqual([]);
    expect(withinDays([ahead], 30, NOW)).toEqual([]);
  });

  it("still plots one dated exactly now, at the right-hand edge", () => {
    const { points } = chartSeries([onTheDot], NOW);
    expect(points).toHaveLength(1);
    // Not merely close to 1: a point past the edge would be drawn outside the
    // plot and to the right of the last gridline's label.
    expect(points[0].x).toBe(1);
    expect(withinDays([onTheDot], 30, NOW).map((entry) => entry.id)).toEqual(["on the dot"]);
  });
});

/**
 * Streaks and standings are counted in local calendar days, so these build
 * their timestamps with setDate/setHours from a fixed local noon rather than
 * by subtracting fixed milliseconds. Subtracting 24h at a time drifts across a
 * DST boundary and lands the "same" log on the previous day in half the world.
 */
const LOCAL_NOON = new Date(2026, 4, 20, 12, 0, 0, 0);
const NOW_LOCAL = LOCAL_NOON.getTime();

function localLog(
  id: string,
  daysAgo: number,
  score: PoopLog["score"],
  { hour = 12, dogId = "d1" }: { hour?: number; dogId?: string } = {},
): PoopLog {
  const at = new Date(LOCAL_NOON);
  at.setDate(at.getDate() - daysAgo);
  at.setHours(hour, 0, 0, 0);
  return { id, dogId, score, color: null, flags: [], loggedAt: at.toISOString() };
}

describe("regularity", () => {
  it("is zero with no logs", () => {
    expect(regularity([], NOW_LOCAL)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const logs = [localLog("a", 0, 2), localLog("b", 1, 3), localLog("c", 2, 2)];
    expect(regularity(logs, NOW_LOCAL)).toBe(3);
  });

  it("counts a day once however many times it was logged", () => {
    const logs = [localLog("a", 0, 2, { hour: 8 }), localLog("b", 0, 3, { hour: 19 })];
    expect(regularity(logs, NOW_LOCAL)).toBe(1);
  });

  it("stops at the first missing day", () => {
    const logs = [localLog("a", 0, 2), localLog("b", 1, 2), localLog("skip", 3, 2)];
    expect(regularity(logs, NOW_LOCAL)).toBe(2);
  });

  it("survives a day that has not been logged yet", () => {
    // Nothing today, but yesterday and the day before are there: the dog has
    // simply not been out yet, which is not the same as breaking the streak.
    const logs = [localLog("a", 1, 2), localLog("b", 2, 2)];
    expect(regularity(logs, NOW_LOCAL)).toBe(2);
  });

  it("is zero once the run is two days stale", () => {
    expect(regularity([localLog("a", 2, 2), localLog("b", 3, 2)], NOW_LOCAL)).toBe(0);
  });

  it("carries the streak over midnight rather than restarting it", () => {
    // A log fifteen seconds into the new day, and a reading taken as it was
    // saved - which is what useNow gives, since it steps on the write. The run
    // has to end on the day the cursor starts from, and that day is now the
    // new one: reading yesterday as the end instead would count the new log
    // for nothing and show a streak of one on the screen that just recorded a
    // second consecutive day.
    const midnight = new Date(LOCAL_NOON);
    midnight.setHours(24, 0, 0, 0);
    const fresh: PoopLog = {
      ...localLog("fresh", 0, 2),
      loggedAt: new Date(midnight.getTime() + 15_000).toISOString(),
    };
    expect(regularity([fresh, localLog("today", 0, 2)], midnight.getTime() + 15_000)).toBe(2);
  });

  it("ignores scores entirely - it counts logging, not quality", () => {
    const logs = [localLog("a", 0, 7), localLog("b", 1, 1)];
    expect(regularity(logs, NOW_LOCAL)).toBe(2);
  });
});

describe("timeOfDayNote", () => {
  const atHour = (hour: number) => localLog("x", 0, 2, { hour }).loggedAt;

  it("marks the small hours and the early ones", () => {
    expect(timeOfDayNote(atHour(3))).toBe("Rough night.");
    expect(timeOfDayNote(atHour(6))).toBe("Dawn patrol.");
    expect(timeOfDayNote(atHour(23))).toBe("Late one.");
  });

  it("says nothing about an ordinary hour", () => {
    // 7 is the boundary the Dawn Patrol milestone is scored on too.
    expect(timeOfDayNote(atHour(7))).toBeNull();
    expect(timeOfDayNote(atHour(9))).toBeNull();
    expect(timeOfDayNote(atHour(14))).toBeNull();
  });

  it("does not throw on an unparseable timestamp", () => {
    expect(timeOfDayNote("not-a-date")).toBeNull();
  });
});

describe("withinDays", () => {
  it("keeps the window and drops everything outside it", () => {
    const logs = [localLog("in", 3, 2), localLog("edge", 30, 2), localLog("out", 31, 2)];
    expect(withinDays(logs, 30, NOW_LOCAL).map((entry) => entry.id)).toEqual(["in", "edge"]);
  });

  it("drops logs dated in the future", () => {
    expect(withinDays([localLog("ahead", -1, 2)], 30, NOW_LOCAL)).toEqual([]);
  });
});

function makeDog(id: string, name: string): Dog {
  return { id, name, createdAt: new Date(2026, 0, 1).toISOString() };
}

/** Groups logs the way logsByDog does, then ranks them. */
function table(logs: readonly PoopLog[], dogs: readonly Dog[]) {
  const byDog = new Map<string, PoopLog[]>();
  for (const entry of logs) {
    byDog.set(entry.dogId, [...(byDog.get(entry.dogId) ?? []), entry]);
  }
  return standings(dogs, byDog, NOW_LOCAL);
}

describe("standings", () => {
  it("ranks the dog closest to the middle of the ideal band first", () => {
    const dogs = [makeDog("d1", "Ada"), makeDog("d2", "Bo")];
    const logs = [
      localLog("a", 1, 3, { dogId: "d1" }),
      localLog("b", 1, 7, { dogId: "d2" }),
      localLog("c", 2, 2, { dogId: "d1" }),
      localLog("d", 2, 6, { dogId: "d2" }),
    ];
    expect(table(logs, dogs).map((row) => row.dog.name)).toEqual(["Ada", "Bo"]);
  });

  it("penalises a dog that alternates either side of the band", () => {
    // A 1 and a 4 average to 2.5, dead centre, and a plain mean would call
    // that a perfect week. Deviation is what stops it.
    const dogs = [makeDog("d1", "Steady"), makeDog("d2", "Swinger")];
    const logs = [
      localLog("a", 1, 2, { dogId: "d1" }),
      localLog("b", 2, 3, { dogId: "d1" }),
      localLog("c", 1, 1, { dogId: "d2" }),
      localLog("d", 2, 4, { dogId: "d2" }),
    ];
    const rows = table(logs, dogs);
    expect(rows[0].dog.name).toBe("Steady");
    expect(rows[1].average).toBeCloseTo(2.5);
  });

  it("leaves out dogs with nothing logged this week", () => {
    const dogs = [makeDog("d1", "Ada"), makeDog("d2", "Absent")];
    const logs = [localLog("a", 1, 2, { dogId: "d1" }), localLog("b", 20, 2, { dogId: "d2" })];
    expect(table(logs, dogs).map((row) => row.dog.id)).toEqual(["d1"]);
  });

  it("breaks ties by name so the order never wobbles", () => {
    const dogs = [makeDog("d2", "Zeb"), makeDog("d1", "Ada")];
    const logs = [localLog("a", 1, 2, { dogId: "d1" }), localLog("b", 1, 2, { dogId: "d2" })];
    expect(table(logs, dogs).map((row) => row.dog.name)).toEqual(["Ada", "Zeb"]);
  });
});
