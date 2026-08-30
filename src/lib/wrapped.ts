import { longestIdealRun } from "@/lib/achievements";
import { scoreInfo } from "@/lib/purina";
import { dayKey, loggedDays } from "@/lib/trend";
import type { Dog, FecalScore, PoopColor, PoopLog, Store } from "@/lib/types";

/**
 * A year in review, computed entirely from the local record.
 *
 * Pure and dateless apart from what it is handed, so the whole summary is
 * testable without a DOM and without freezing the clock in the component.
 */
export type Tally<T> = { value: T; count: number };

export type Wrapped = {
  year: number;
  total: number;
  /** Dogs with at least one log this year. */
  dogs: number;
  average: number | null;
  /** Share of the year's logs inside the ideal band, 0-1. */
  idealShare: number;
  topScore: Tally<FecalScore> | null;
  topColor: Tally<PoopColor> | null;
  /** Local hour, 0-23. */
  busiestHour: Tally<number> | null;
  /** Local `YYYY-MM-DD`. */
  busiestDay: Tally<string> | null;
  activeDays: number;
  longestIdealRun: number;
  flagged: number;
  perDog: { dog: Dog; total: number; average: number }[];
};

/** Descending by count, ties broken by first appearance, so it is stable. */
function top<T>(counts: ReadonlyMap<T, number>): Tally<T> | null {
  let best: Tally<T> | null = null;
  for (const [value, count] of counts) {
    if (best === null || count > best.count) {
      best = { value, count };
    }
  }
  return best;
}

function tally<T>(items: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

function inYear(log: PoopLog, year: number): boolean {
  const at = new Date(log.loggedAt);
  return !Number.isNaN(at.getTime()) && at.getFullYear() === year;
}

/** Years with at least one log, newest first. Drives the year switcher. */
export function loggedYears(store: Store): number[] {
  const years = new Set<number>();
  for (const log of store.logs) {
    const at = new Date(log.loggedAt);
    if (!Number.isNaN(at.getTime())) {
      years.add(at.getFullYear());
    }
  }
  return [...years].sort((a, b) => b - a);
}

export function wrapUp(store: Store, year: number): Wrapped {
  const logs = store.logs.filter((log) => inYear(log, year));
  const scores = logs.map((log) => log.score);
  const colors = logs.flatMap((log) => (log.color === null ? [] : [log.color]));

  const perDog = store.dogs
    .flatMap((dog) => {
      const own = logs.filter((log) => log.dogId === dog.id);
      if (own.length === 0) {
        return [];
      }
      return [
        {
          dog,
          total: own.length,
          average: own.reduce((sum, log) => sum + log.score, 0) / own.length,
        },
      ];
    })
    .sort((a, b) => b.total - a.total || a.dog.name.localeCompare(b.dog.name));

  return {
    year,
    total: logs.length,
    dogs: perDog.length,
    average: logs.length === 0 ? null : scores.reduce((sum, s) => sum + s, 0) / logs.length,
    idealShare:
      logs.length === 0 ? 0 : logs.filter((log) => scoreInfo(log.score).ideal).length / logs.length,
    topScore: top(tally(scores)),
    topColor: top(tally(colors)),
    busiestHour: top(tally(logs.map((log) => new Date(log.loggedAt).getHours()))),
    busiestDay: top(tally(logs.map((log) => dayKey(new Date(log.loggedAt))))),
    // Bounded to the year already, so "now" can be the end of it.
    activeDays: loggedDays(logs, Date.parse(`${year + 1}-01-01T00:00:00Z`)).size,
    longestIdealRun: longestIdealRun(logs),
    flagged: logs.filter((log) => log.flags.length > 0).length,
    perDog,
  };
}

/** "7am", "12pm", "11pm" - the summary reads better than a 24-hour clock. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${suffix}`;
}
