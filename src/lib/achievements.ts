import { scoreInfo } from "@/lib/purina";
import { DAWN_HOUR, dayKey, hasHappened } from "@/lib/trend";
import { POOP_COLORS, type PoopLog } from "@/lib/types";

/**
 * Milestones derived from the record, plus one from the meta store.
 *
 * Everything here is a pure function of the logs, so nothing extra has to be
 * persisted and nothing can drift out of step with a deleted entry: unlog the
 * only 7 and Code Brown goes back to locked, which is the honest behaviour for
 * something computed off a record the user can edit.
 *
 * Deliberately nothing keyed on blood, mucus or worms. Those are the flags
 * somebody ticks on a bad night, and there is no version of a reward for them
 * that reads well at 3am.
 */
export type Achievement = {
  id: string;
  name: string;
  blurb: string;
  earned: boolean;
  /** Filled bar on the shelf; `current` is capped at `goal`. */
  progress: { current: number; goal: number };
};

const IDEAL_RUN_GOAL = 7;
const CENTURY_GOAL = 100;

function isNextDay(day: string, next: string): boolean {
  // Parsed without a zone so it lands in local time, matching dayKey.
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return dayKey(date) === next;
}

/**
 * The longest run of consecutive days on which everything logged was ideal.
 * A day with no logs at all breaks the run rather than extending it - the
 * streak is for keeping a dog in the band, not for looking away.
 *
 * Days that have not happened yet are dropped, the same way loggedDays and
 * chartSeries drop them: a device whose clock ran ahead, or a record edited
 * by hand, should not be able to extend a streak into tomorrow.
 */
export function longestIdealRun(logs: readonly PoopLog[], now = Date.now()): number {
  const spotless = new Map<string, boolean>();
  for (const log of logs) {
    const at = new Date(log.loggedAt);
    if (!hasHappened(at.getTime(), now)) {
      continue;
    }
    const key = dayKey(at);
    spotless.set(key, (spotless.get(key) ?? true) && scoreInfo(log.score).ideal);
  }

  const days = [...spotless.entries()]
    .filter(([, allIdeal]) => allIdeal)
    .map(([key]) => key)
    // Fixed-width YYYY-MM-DD keys, so plain string order is chronological
    // order. localeCompare is neither of those things - see compareTime - and
    // here it would also be a collation per comparison for nothing.
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && isNextDay(previous, day) ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Shared shape for "N of M done", with the bar never overrunning its goal. */
function earned(current: number, goal: number) {
  return { earned: current >= goal, progress: { current: Math.min(current, goal), goal } };
}

function has(logs: readonly PoopLog[], predicate: (log: PoopLog) => boolean): number {
  return logs.filter(predicate).length;
}

export function achievements(
  logs: readonly PoopLog[],
  options: Readonly<{ exported: boolean }> = { exported: false },
  now = Date.now(),
): Achievement[] {
  // Every milestone is scored on this rather than on `logs`, not just the
  // streak. A record carrying a log dated 2030 - clock skew, or an edited
  // store, which is exactly what the guard inside longestIdealRun exists for -
  // would otherwise unlock Code Brown, The Namesake, Dawn Patrol, Full
  // Spectrum and Century today, on the strength of something that has not
  // happened. Unparseable entries go the same way, which is why the hour below
  // no longer has to check for one.
  const happened = logs.filter((log) => hasHappened(new Date(log.loggedAt).getTime(), now));

  const idealRun = longestIdealRun(happened, now);
  const namesakes = has(happened, (log) => log.score === 3);
  const codeBrowns = has(happened, (log) => log.score === 7);
  const dawns = has(happened, (log) => new Date(log.loggedAt).getHours() < DAWN_HOUR);
  const colors = new Set(happened.flatMap((log) => (log.color === null ? [] : [log.color])));

  return [
    {
      id: "solid-week",
      name: "Solid Week",
      blurb: "Seven days running with nothing outside the ideal band.",
      ...earned(idealRun, IDEAL_RUN_GOAL),
    },
    {
      id: "namesake",
      name: "The Namesake",
      blurb: "Logged a 3. The chart calls it “log-like”. So do we.",
      ...earned(namesakes, 1),
    },
    {
      id: "code-brown",
      name: "Code Brown",
      blurb: "Logged a 7. Watery, no texture, flat. You were there.",
      ...earned(codeBrowns, 1),
    },
    {
      id: "dawn-patrol",
      name: "Dawn Patrol",
      blurb: "Logged something before 7am. Nobody made you do this.",
      ...earned(dawns, 1),
    },
    {
      id: "full-spectrum",
      name: "Full Spectrum",
      blurb: "Every color on the chart, at least once. Ideally not this week.",
      ...earned(colors.size, POOP_COLORS.length),
    },
    {
      id: "statistician",
      name: "Statistician",
      blurb: "Exported a CSV. Someone in this house owns a spreadsheet.",
      ...earned(options.exported ? 1 : 0, 1),
    },
    {
      id: "century",
      name: "Century",
      blurb: "One hundred entries. This is a hobby now.",
      ...earned(happened.length, CENTURY_GOAL),
    },
  ];
}
