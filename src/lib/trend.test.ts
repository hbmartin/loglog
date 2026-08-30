import { describe, expect, it } from "vitest";
import { chartSeries, summarise, timeAgo } from "@/lib/trend";
import type { PoopLog } from "@/lib/types";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

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
    expect(xs).toEqual(xs.toSorted((a, b) => a - b));
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

  it("emits weekly ticks with the newest anchored on today", () => {
    const { ticks } = chartSeries([], NOW);
    expect(ticks).toHaveLength(5);
    expect(ticks[ticks.length - 1].x).toBeCloseTo(1);
    expect(ticks[0].x).toBeLessThan(ticks[1].x);
  });

  it("keeps a single log plottable", () => {
    expect(chartSeries([log(5, 4)], NOW).points).toHaveLength(1);
  });
});
