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
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return now;
}
