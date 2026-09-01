import { useEffect, useState } from "react";
import { subscribeToStore } from "@/lib/storage";

/**
 * How often the clock steps while nothing else moves it. A minute is the
 * smallest unit anything on screen is measured in - see timeAgo - so it is
 * also the longest a reading can be stale without a caption going wrong.
 */
export const CLOCK_TICK_MS = 60_000;

/**
 * A clock the render can depend on: behind real time by up to one step, and
 * never behind the store.
 *
 * Everything in trend.ts takes `now` as a parameter so it stays pure, which
 * leaves the caller to decide where the value comes from. Letting each call
 * default to Date.now() looks equivalent and is not: the results are memoised
 * on the log list, so the reading is frozen at whatever moment the logs last
 * changed. An installed app left open in a pocket overnight would still be
 * counting a log from eight days ago as "past 7 days", and no amount of
 * tapping would move it - only adding or deleting a log would.
 *
 * The visibility listener covers the case that actually happens: timers are
 * throttled or stopped outright while the app is backgrounded, so coming back
 * to it hours later must not wait out an interval first.
 *
 * The store subscription is the half that lets the windows measured against
 * this reading compare exactly. A clock that steps rather than runs lags real
 * time between steps, so a score saved twenty seconds after the last step is
 * dated after `now`; a window reading that as the future drops the log the
 * user just saved, and the history list shows the entry while the chart, the
 * week count, the mean and the streak all sit unchanged until the minute is
 * up - the app's primary action appearing not to register. A write is the only
 * event that can produce such a record, this tab's and another tab's alike,
 * and it is one this module can hear: stepping on it keeps the reading ahead
 * of everything in the store.
 *
 * That is what leaves hasHappened free to be exact, and so to keep rejecting
 * the records it exists for - a device whose clock genuinely ran ahead, or a
 * log imported from one that had. Forgiving a step's worth of future inside
 * every window helper instead widens the guard for the callers that read the
 * clock exactly as well, the report screen among them, and none of those has
 * any lag to forgive.
 *
 * A reading taken with `new Date()` and then held is the case that guard does
 * not cover, which is why useSnapshotNow below exists rather than each screen
 * rolling its own.
 */
export function useNow(): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const advance = () => setTick(Date.now());
    const timer = window.setInterval(advance, CLOCK_TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        advance();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const unsubscribe = subscribeToStore(advance);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
    };
  }, []);

  return tick;
}

/**
 * A reading for a screen that is a snapshot: taken once and then held still,
 * stepped only when the record it describes changes.
 *
 * The report screen wants a fixed moment - the timestamp it prints, the
 * 30-day window, the chart and the table all have to be the same one, and a
 * figure that moves while somebody reads it off a page they are about to print
 * is not a snapshot. What it cannot have is a moment fixed *before* the record
 * it renders: it re-renders on every write, this tab's and another tab's, so a
 * reading frozen at mount and an exact hasHappened between them meant a log
 * saved after the report was opened - a second tab, or a PWA left on this
 * screen - was dated after `now` forever. It vanished from the chart, from
 * "Entries", from the mean, from "Within 2-3" and from the table, while the
 * header went on counting it in the entries on file.
 *
 * So: no interval and no visibility listener, because nothing here is measured
 * in minutes elapsed, and the store subscription that useNow has, because that
 * is the half that keeps the reading from being older than what it describes.
 */
export function useSnapshotNow(): number {
  const [taken, setTaken] = useState(() => Date.now());

  useEffect(() => subscribeToStore(() => setTaken(Date.now())), []);

  return taken;
}
