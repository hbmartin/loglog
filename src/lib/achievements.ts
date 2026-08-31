import { scoreInfo } from "@/lib/purina";
import { DAWN_HOUR, dayKey, hasHappened } from "@/lib/trend";
import { POOP_COLORS, type PoopColor, type PoopLog } from "@/lib/types";

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
 * A log with its timestamp already parsed, so that the milestones below - each
 * of which needs the day, the hour or neither - can share one Date per log
 * rather than building their own. This runs on every render of the dog page
 * whose deps include `now`, which is once a minute plus once per write.
 */
type Dated = { log: PoopLog; at: Date };

/**
 * The logs that have happened, in the order given.
 *
 * Days that have not happened yet are dropped, the same way loggedDays and
 * chartSeries drop them: a device whose clock ran ahead, or a record edited
 * by hand, should not be able to extend a streak into tomorrow or unlock a
 * milestone today. Unparseable entries go the same way, which is why nothing
 * downstream has to check for one.
 */
function dated(logs: readonly PoopLog[], now: number): Dated[] {
  return logs.flatMap((log) => {
    const at = new Date(log.loggedAt);
    return hasHappened(at.getTime(), now) ? [{ log, at }] : [];
  });
}

/**
 * The longest run of consecutive days on which everything logged was ideal.
 * A day with no logs at all breaks the run rather than extending it - the
 * streak is for keeping a dog in the band, not for looking away.
 *
 * Takes entries already filtered by `dated`, so it neither re-guards nor
 * re-parses what its one non-test caller has just done.
 */
function longestRun(entries: readonly Dated[]): number {
  const spotless = new Map<string, boolean>();
  for (const { log, at } of entries) {
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

/** The same run, for callers holding raw logs - the yearly summary and tests. */
export function longestIdealRun(logs: readonly PoopLog[], now = Date.now()): number {
  return longestRun(dated(logs, now));
}

/** Shared shape for "N of M done", with the bar never overrunning its goal. */
function earned(current: number, goal: number) {
  return { earned: current >= goal, progress: { current: Math.min(current, goal), goal } };
}

export function achievements(
  logs: readonly PoopLog[],
  options: Readonly<{ exported: boolean }> = { exported: false },
  now = Date.now(),
): Achievement[] {
  // Every milestone is scored on this rather than on `logs`, not just the
  // streak. A record carrying a log dated 2030 - clock skew, or an edited
  // store - would otherwise unlock Code Brown, The Namesake, Dawn Patrol, Full
  // Spectrum and Century today, on the strength of something that has not
  // happened.
  const happened = dated(logs, now);

  // Folded in one pass. A filter per counter walked the list four times over,
  // and two of them built a second Date for a timestamp `dated` has already
  // parsed.
  const idealRun = longestRun(happened);
  let namesakes = 0;
  let codeBrowns = 0;
  let dawns = 0;
  const colors = new Set<PoopColor>();
  for (const { log, at } of happened) {
    if (log.score === 3) {
      namesakes += 1;
    }
    if (log.score === 7) {
      codeBrowns += 1;
    }
    if (at.getHours() < DAWN_HOUR) {
      dawns += 1;
    }
    if (log.color !== null) {
      colors.add(log.color);
    }
  }

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
