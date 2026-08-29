import { IDEAL_MAX, IDEAL_MIN } from "@/lib/purina";
import type { PoopLog } from "@/lib/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
    recent.length === 0
      ? null
      : recent.reduce((sum, log) => sum + log.score, 0) / recent.length;

  return {
    total: logs.length,
    lastWeek: recent.length,
    average,
    offIdeal: recent.filter(
      (log) => log.score < IDEAL_MIN || log.score > IDEAL_MAX
    ).length,
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
