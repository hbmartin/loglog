import { IDEAL_MAX, IDEAL_MIN, scoreInfo } from "@/lib/purina";
import { FECAL_SCORES, type FecalScore, type PoopLog } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Gridlines on the trend chart, including both ends of the window. */
const TICK_COUNT = 5;

export type Trend = {
  total: number;
  lastWeek: number;
  /** Mean score over the last week, or null when nothing was logged. */
  average: number | null;
  offIdeal: number;
};

export function summarise(logs: readonly PoopLog[], now = Date.now()): Trend {
  const recent = logs.filter((log) => {
    const elapsed = now - new Date(log.loggedAt).getTime();
    return elapsed >= 0 && elapsed <= WEEK_MS;
  });
  const average =
    recent.length === 0 ? null : recent.reduce((sum, log) => sum + log.score, 0) / recent.length;

  return {
    total: logs.length,
    lastWeek: recent.length,
    average,
    offIdeal: recent.filter((log) => !scoreInfo(log.score).ideal).length,
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
      if (Number.isNaN(at) || at < start || at > now) {
        return [];
      }
      return [
        {
          id: log.id,
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
