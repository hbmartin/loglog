// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useNow } from "@/lib/clock";
import { CLOCK_TICK_MS } from "@/lib/trend";

const BASE = Date.parse("2026-03-10T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

  it("never runs ahead of the wall clock", () => {
    // The reading is only ever a past Date.now(). What covers a log written
    // since the last step is the tolerance in trend.ts, not a clock pulled
    // forward to meet it - see the hasHappened cases there.
    const { result } = renderHook(() => useNow());
    expect(result.current).toBeLessThanOrEqual(Date.now());
  });
});
