import { useEffect, useState } from "react";

/** Matches the finest granularity anything on screen renders: "3m ago". */
const TICK_MS = 60_000;

/**
 * A clock the render can depend on.
 *
 * Everything in trend.ts takes `now` as a parameter so it stays pure, which
 * leaves the caller to decide where the value comes from. Letting each call
 * default to Date.now() looks equivalent and is not: the results are memoised
 * on the log list, so the reading is frozen at whatever moment the logs last
 * changed. An installed app left open in a pocket overnight would still be
 * counting a log from eight days ago as "past 7 days", and no amount of
 * tapping would move it - only adding or deleting a log would.
 *
 * The visibility listener is what covers the case that actually happens:
 * timers are throttled or stopped outright while the app is backgrounded, so
 * coming back to it hours later must not wait out an interval first.
 *
 * `latest` is the newest timestamp the caller is about to measure windows
 * against, and it exists because this clock steps rather than runs: between
 * ticks it lags real time by up to a minute. Every helper in trend.ts drops
 * logs dated after `now`, so a score tapped twenty seconds after the last
 * tick is filtered straight back out of the chart, the week count, the mean
 * and the streak - the history list shows it, and every other reading on the
 * screen sits unchanged until the tick lands. The app's primary action
 * appears not to register. Passing the newest entry pulls the clock forward
 * to cover it.
 *
 * By one tick at most, though. That is the whole of this clock's own error,
 * and past it the future-dated logs those guards exist for - a device whose
 * clock ran ahead, a record imported from one that had - have to stay out of
 * the window.
 */
export function useNow(latest?: string): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const advance = () => setTick(Date.now());
    const timer = window.setInterval(advance, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        advance();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (latest === undefined) {
    return tick;
  }
  const at = Date.parse(latest);
  return Number.isNaN(at) || at <= tick ? tick : Math.min(at, tick + TICK_MS);
}
