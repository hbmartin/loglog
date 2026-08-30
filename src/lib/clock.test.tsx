// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useNow } from "@/lib/clock";

const TICK_MS = 60_000;
const BASE = Date.parse("2026-03-10T12:00:00.000Z");

function iso(at: number): string {
  return new Date(at).toISOString();
}

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
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(result.current).toBe(BASE + TICK_MS);
  });

  it("covers a log written between two ticks", () => {
    // What this is for: every window helper in trend.ts drops logs dated
    // after `now`, so a score saved twenty seconds after the last tick read
    // as being in the future to all of them. The history list showed it and
    // the chart, the week count, the mean and the streak did not move until
    // the minute was up.
    const { result } = renderHook(() => useNow(iso(BASE + 20_000)));
    expect(result.current).toBe(BASE + 20_000);
  });

  it("will not run further ahead of itself than it can be wrong", () => {
    // A device whose clock ran ahead, or a record imported from one that
    // did. Covering that would push every window into the future, which is
    // the whole reason those helpers drop future-dated logs.
    const { result } = renderHook(() => useNow(iso(BASE + 24 * 60 * 60 * 1000)));
    expect(result.current).toBe(BASE + TICK_MS);
  });

  it("ignores a timestamp already in the past, or one it cannot read", () => {
    expect(renderHook(() => useNow(iso(BASE - 5_000))).result.current).toBe(BASE);
    expect(renderHook(() => useNow("the other day")).result.current).toBe(BASE);
  });
});
