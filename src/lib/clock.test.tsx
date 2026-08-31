// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { CLOCK_TICK_MS, useNow } from "@/lib/clock";
import { __resetCache, addLog } from "@/lib/storage";

const BASE = Date.parse("2026-03-10T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
  window.localStorage.clear();
  __resetCache();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  __resetCache();
});

describe("useNow", () => {
  it("reads the clock on mount and steps it once a minute", () => {
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(BASE);

    act(() => {
      vi.advanceTimersByTime(CLOCK_TICK_MS);
    });
    expect(result.current).toBe(BASE + CLOCK_TICK_MS);
  });

  it("catches up on being brought back to the foreground", () => {
    // Timers are throttled or stopped outright while the app is backgrounded,
    // so the interval alone would leave a pocketed phone reading last night's
    // time until a whole tick had run in the foreground.
    const { result } = renderHook(() => useNow());

    act(() => {
      vi.setSystemTime(BASE + 5 * 60 * 60 * 1000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(BASE + 5 * 60 * 60 * 1000);
  });

  it("steps on a write, so nothing in the store is dated after the reading", () => {
    // This is the whole of what lets hasHappened compare exactly. Between
    // steps the clock lags real time by up to a minute, so a score saved
    // twenty seconds after one is dated after the `now` every window in
    // trend.ts measures against: read as the future, the save would move the
    // history list and nothing else - not the chart, the week count, the mean
    // or the streak - until the minute was up.
    const { result } = renderHook(() => useNow());

    let saved = "";
    act(() => {
      vi.setSystemTime(BASE + 20_000);
      saved = addLog({ dogId: "d1", score: 2, color: null, flags: [] }).loggedAt;
    });

    expect(result.current).toBe(BASE + 20_000);
    expect(Date.parse(saved)).toBeLessThanOrEqual(result.current);
  });

  it("stops listening once the screen is gone", () => {
    // The subscription outliving the hook would keep setting state on an
    // unmounted tree on every write for the rest of the session.
    const { result, unmount } = renderHook(() => useNow());
    unmount();

    act(() => {
      vi.setSystemTime(BASE + 20_000);
      addLog({ dogId: "d1", score: 2, color: null, flags: [] });
      vi.advanceTimersByTime(CLOCK_TICK_MS);
    });
    expect(result.current).toBe(BASE);
  });
});
