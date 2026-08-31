import { useEffect, useState } from "react";
import { CLOCK_TICK_MS } from "@/lib/trend";

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
 * This steps rather than runs, so between steps it lags real time by up to
 * CLOCK_TICK_MS and a log written in that gap is dated after the reading it is
 * measured against. That is handled once, in the helpers doing the measuring -
 * see hasHappened - rather than here: a clock told which log to cover would
 * only be as correct as the newest timestamp each screen remembered to hand
 * it, and the next screen to measure a window would quietly reintroduce the
 * bug by not handing it one.
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

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return tick;
}
