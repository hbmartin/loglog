import { scoreInfo } from "@/lib/purina";
import { dayKey } from "@/lib/trend";
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
 */
export function longestIdealRun(logs: readonly PoopLog[]): number {
  const spotless = new Map<string, boolean>();
  for (const log of logs) {
    const at = new Date(log.loggedAt);
    if (Number.isNaN(at.getTime())) {
      continue;
    }
    const key = dayKey(at);
    spotless.set(key, (spotless.get(key) ?? true) && scoreInfo(log.score).ideal);
  }

  const days = [...spotless.entries()]
    .filter(([, allIdeal]) => allIdeal)
    .map(([key]) => key)
    // ISO-shaped keys, so lexicographic order is chronological order.
    .sort((a, b) => a.localeCompare(b));

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
): Achievement[] {
  const idealRun = longestIdealRun(logs);
  const namesakes = has(logs, (log) => log.score === 3);
  const codeBrowns = has(logs, (log) => log.score === 7);
  const dawns = has(logs, (log) => {
    const hour = new Date(log.loggedAt).getHours();
    return !Number.isNaN(hour) && hour < 6;
  });
  const colors = new Set(logs.flatMap((log) => (log.color === null ? [] : [log.color])));

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
      blurb: "Logged something before 6am. Nobody made you do this.",
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
      ...earned(logs.length, CENTURY_GOAL),
    },
  ];
}
