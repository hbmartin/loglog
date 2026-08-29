import { describe, expect, it } from "vitest";
import { summarise, timeAgo } from "@/lib/trend";
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
