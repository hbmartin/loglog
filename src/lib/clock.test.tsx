// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { CLOCK_TICK_MS, useNow, useSnapshotNow } from "@/lib/clock";
import { __listenerCount, __resetCache, addLog } from "@/lib/storage";

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
    //
    // Asserted on the store's subscriber list rather than on what the hook
    // last returned. React does not re-render an unmounted tree, so a leaked
    // listener calling setTick lands nowhere a rendered value can show it:
    // `result.current` is frozen at the last value either way, and the version
    // of this case that checked it passed with the cleanup deleted.
    const { unmount } = renderHook(() => useNow());
    expect(__listenerCount()).toBe(1);

    unmount();
    expect(__listenerCount()).toBe(0);
  });
});

describe("useSnapshotNow", () => {
  it("holds still while the clock runs", () => {
    // The report screen prints this. A figure that steps once a minute while
    // somebody reads it off the page is not the moment the report was taken.
    const { result } = renderHook(() => useSnapshotNow());

    act(() => {
      vi.advanceTimersByTime(5 * CLOCK_TICK_MS);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(BASE);
  });

  it("steps on a write, so nothing in the store is dated after the reading", () => {
    // A held reading and an exact hasHappened between them dropped a log saved
    // after the screen was opened - another tab, or a PWA left on the report -
    // out of the chart, the table and every figure, permanently, while the
    // header went on counting it in the entries on file.
    const { result } = renderHook(() => useSnapshotNow());

    let saved = "";
    act(() => {
      vi.setSystemTime(BASE + 20 * 60_000);
      saved = addLog({ dogId: "d1", score: 2, color: null, flags: [] }).loggedAt;
    });

    expect(result.current).toBe(BASE + 20 * 60_000);
    expect(Date.parse(saved)).toBeLessThanOrEqual(result.current);
  });

  it("stops listening once the screen is gone", () => {
    const { unmount } = renderHook(() => useSnapshotNow());
    expect(__listenerCount()).toBe(1);

    unmount();
    expect(__listenerCount()).toBe(0);
  });
});
