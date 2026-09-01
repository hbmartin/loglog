import { IDEAL_MAX, IDEAL_MIN, scoreInfo } from "@/lib/purina";
import { FECAL_SCORES, type Dog, type FecalScore, type PoopLog } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Gridlines on the trend chart, including both ends of the window. */
const TICK_COUNT = 5;

/**
 * True when `at` is a time at all and has already happened. Every window in
 * this module is measured through it, so a log is either inside all of them or
 * outside all of them.
 *
 * The comparison is exact, with no allowance for a `now` that lags. It does
 * not need one: every reading a screen measures against comes from clock.ts -
 * useNow for a live one, useSnapshotNow for a held one - and the contract both
 * hooks keep is that the reading is never behind the store. What that leaves
 * outside is what this guard exists for, a device whose clock ran ahead or a
 * log imported from one that had.
 */
export function hasHappened(at: number, now: number): boolean {
  return !Number.isNaN(at) && at <= now;
}

/**
 * Chronological order for two ISO-8601 timestamps, oldest first.
 *
 * Parsed rather than compared as text. The stored shape is whatever
 * `z.iso.datetime()` accepts, which leaves the fractional part optional, and
 * for two strings of different precision neither string order nor a locale
 * collation is chronological: "T12:00:00Z" sorts after "T12:00:00.500Z" under
 * both, because "Z" outranks ".", while it is the earlier instant of the two.
 * An imported record is where that arrives.
 */
export function compareTime(a: string, b: string): number {
  const left = Date.parse(a);
  const right = Date.parse(b);
  // A timestamp that will not parse sorts oldest rather than returning NaN.
  // Sort coerces NaN to 0, which makes the entry compare equal to every other
  // one at once: the order is then not transitive, the engine leaves the entry
  // wherever the merge happened to put it - logsForDog index 0 included, which
  // is the log the dog page reads as the latest - and newestLog, which ranks
  // deterministically, disagrees. Oldest is the answer that keeps the two the
  // same, and it is the honest place for a record whose date is unreadable.
  if (Number.isNaN(left)) {
    return Number.isNaN(right) ? 0 : -1;
  }
  if (Number.isNaN(right)) {
    return 1;
  }
  return left - right;
}

export type Trend = {
  /** Logs that have happened; one dated in the future is not among them. */
  total: number;
  lastWeek: number;
  /** Mean score over the last week, or null when nothing was logged. */
  average: number | null;
  offIdeal: number;
  /**
   * When the newest log that has happened was logged, or null for a record
   * with nothing in it yet. Read through the same guard as the counts beside
   * it, so the "Last" caption cannot describe an entry the rest of the summary
   * dropped.
   */
  lastLoggedAt: string | null;
};

export function summarise(logs: readonly PoopLog[], now = Date.now()): Trend {
  // One pass, and one parse per log - every field below is folded in this
  // loop, none of them walk the list again. `total` is counted through the
  // same guard as the rest: a log dated 2030 that raised the total while the
  // week count, the mean, the streak and the chart all dropped it left the
  // screen claiming a history it then refused to describe - "Last: just now",
  // no mean, no streak, an empty chart and every milestone locked.
  let total = 0;
  let lastWeek = 0;
  let sum = 0;
  let offIdeal = 0;
  let lastLoggedAt: string | null = null;
  // Newest first is what logsForDog hands over, but nothing here relies on the
  // caller having sorted: the newest is tracked by instant.
  let lastAt = Number.NEGATIVE_INFINITY;

  for (const log of logs) {
    const at = new Date(log.loggedAt).getTime();
    if (!hasHappened(at, now)) {
      continue;
    }
    total += 1;
    if (at > lastAt) {
      lastAt = at;
      lastLoggedAt = log.loggedAt;
    }
    if (now - at <= WEEK_MS) {
      lastWeek += 1;
      sum += log.score;
      if (!scoreInfo(log.score).ideal) {
        offIdeal += 1;
      }
    }
  }

  return {
    total,
    lastWeek,
    average: lastWeek === 0 ? null : sum / lastWeek,
    offIdeal,
    lastLoggedAt,
  };
}

const SCORE_MIN = FECAL_SCORES[0];
const SCORE_MAX = FECAL_SCORES[FECAL_SCORES.length - 1];

/**
 * Score to a 0-1 fraction measured from the top of the plot, so it drops
 * straight into SVG coordinates. The scale runs 7 at the top down to 1 at the
 * bottom, matching how the axis is drawn.
 */
function scoreToY(score: number): number {
  return (SCORE_MAX - score) / (SCORE_MAX - SCORE_MIN);
}

export type ChartPoint = {
  /** The log's id, so a point stays identifiable across re-renders. */
  id: string;
  /** 0 at the window's oldest edge, 1 at now. */
  x: number;
  /** 0 at the top of the score scale, 1 at the bottom. */
  y: number;
  score: FecalScore;
  loggedAt: string;
  ideal: boolean;
};

export type ChartSeries = {
  points: ChartPoint[];
  ticks: { x: number; label: string }[];
  /** The ideal 2-3 band, in the same y units as the points. */
  band: { top: number; bottom: number };
};

/**
 * Score-over-time geometry for the last `days`, normalised to 0-1 on both
 * axes so the component owns every pixel decision. Pure, so it is testable
 * without a DOM.
 */
export function chartSeries(logs: readonly PoopLog[], now = Date.now(), days = 30): ChartSeries {
  const span = days * DAY_MS;
  const start = now - span;

  const points = logs
    .flatMap((log) => {
      const at = new Date(log.loggedAt).getTime();
      if (!hasHappened(at, now) || at < start) {
        return [];
      }
      return [
        {
          id: log.id,
          // hasHappened above puts `at` at or before `now`, so this cannot
          // exceed 1 and needs no clamp: a point past x = 1 would be drawn
          // outside the plot and to the right of the last gridline's label.
          x: (at - start) / span,
          y: scoreToY(log.score),
          score: log.score,
          loggedAt: log.loggedAt,
          // Same source as the history list's badges, so a dot and its row
          // can never disagree about whether a score is ideal.
          ideal: scoreInfo(log.score).ideal,
        },
      ];
    })
    // flatMap already returned a fresh array; sorting it in place mutates
    // nothing shared. Logs arrive newest-first, a polyline needs time order.
    .sort((a, b) => a.x - b.x);

  // Gridlines evenly spanning the window with both ends pinned: the leftmost
  // label is the window's oldest edge and the rightmost is "now". Stepping
  // back weekly from today instead would stop 28 days into a 30-day window,
  // leaving the oldest two days without a gridline and putting the first
  // label two days to the right of where the plot actually starts.
  const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const fraction = index / (TICK_COUNT - 1);
    return {
      x: fraction,
      label: new Date(start + fraction * span).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    };
  });

  return {
    points,
    ticks,
    // Half a step of padding, so a score of 2 or 3 sits inside the band
    // instead of balanced on its edge.
    band: { top: scoreToY(IDEAL_MAX + 0.5), bottom: scoreToY(IDEAL_MIN - 0.5) },
  };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff)) {
    return "unknown";
  }
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Local calendar day, `YYYY-MM-DD`. Streaks and the yearly summary are both
 * counted the way the user experienced them - a 1am log belongs to the night
 * it happened, not to UTC's idea of the date.
 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The local days that have at least one log that has happened. */
export function loggedDays(logs: readonly PoopLog[], now = Date.now()): Set<string> {
  const days = new Set<string>();
  for (const log of logs) {
    const at = new Date(log.loggedAt);
    if (hasHappened(at.getTime(), now)) {
      days.add(dayKey(at));
    }
  }
  return days;
}

/**
 * Consecutive days ending today with at least one log - the pun is the point.
 *
 * A run is allowed to end yesterday as well as today: the dog has not
 * necessarily been out yet this morning, and a streak that evaporates at
 * midnight would only ever punish people for logging early.
 */
export function regularity(logs: readonly PoopLog[], now = Date.now()): number {
  const days = loggedDays(logs, now);
  if (days.size === 0) {
    return 0;
  }

  // No probe of tomorrow here. A log saved at 00:00:15 is on a day a stepping
  // clock may not have reached yet, but useNow steps on the write that saved
  // it, so `now` is on that day by the time this runs - see clock.ts.
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) {
      return 0;
    }
  }

  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/**
 * The hour a dawn walk stops being one. Exported because the Dawn Patrol
 * milestone is scored on the same boundary: the app must not congratulate
 * somebody on an early start and then refuse to credit it.
 */
export const DAWN_HOUR = 7;

/**
 * An aside for the save confirmation, or null for the overwhelming majority
 * of logs that happen at an unremarkable hour. Never about the score - only
 * about the clock - so it can never make light of a bad result.
 */
export function timeOfDayNote(iso: string): string | null {
  const hour = new Date(iso).getHours();
  if (Number.isNaN(hour)) {
    return null;
  }
  if (hour < 5) return "Rough night.";
  if (hour < DAWN_HOUR) return "Dawn patrol.";
  if (hour >= 23) return "Late one.";
  return null;
}

/** Midpoint of the ideal band; distance from it is what standings rank on. */
const IDEAL_MID = (IDEAL_MIN + IDEAL_MAX) / 2;

export type Standing = {
  dog: Dog;
  logs: number;
  average: number;
  /** Mean absolute distance from the middle of the ideal band. Lower is better. */
  deviation: number;
};

/**
 * A leaderboard for multi-dog households, over the past week.
 *
 * Ranked on mean distance from the middle of the ideal band rather than on
 * mean score, because a 1 and a 4 are equally wrong in opposite directions and
 * a plain average would quietly reward a dog for alternating between them.
 * Dogs with nothing logged this week are left out rather than ranked last -
 * not logging is not a result.
 */
export function standings(
  dogs: readonly Dog[],
  byDog: ReadonlyMap<string, readonly PoopLog[]>,
  now = Date.now(),
): Standing[] {
  return dogs
    .flatMap((dog) => {
      const recent = (byDog.get(dog.id) ?? []).filter((log) => {
        const at = new Date(log.loggedAt).getTime();
        return hasHappened(at, now) && now - at <= WEEK_MS;
      });
      if (recent.length === 0) {
        return [];
      }
      const total = recent.reduce((sum, log) => sum + log.score, 0);
      const spread = recent.reduce((sum, log) => sum + Math.abs(log.score - IDEAL_MID), 0);
      return [
        {
          dog,
          logs: recent.length,
          average: total / recent.length,
          deviation: spread / recent.length,
        },
      ];
    })
    .sort((a, b) => a.deviation - b.deviation || a.dog.name.localeCompare(b.dog.name));
}

/**
 * Logs from the last `days`, newest first, dropping anything unparseable or
 * dated in a future hasHappened will not forgive. `now` is a parameter rather
 * than a call inside a component so the report screen can memoise this without
 * doing impure work during render.
 */
export function withinDays(logs: readonly PoopLog[], days: number, now = Date.now()): PoopLog[] {
  const cutoff = now - days * DAY_MS;
  return logs.filter((log) => {
    const at = new Date(log.loggedAt).getTime();
    return hasHappened(at, now) && at >= cutoff;
  });
}
