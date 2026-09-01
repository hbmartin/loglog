// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useNow } from "@/lib/clock";
import { __listenerCount, __resetCache, useStore } from "@/lib/storage";
import type { Store } from "@/lib/types";

const KEY = "loglog:v1";

function persisted(logs: number): Store {
  return {
    version: 1,
    dogs: [{ id: "d1", name: "Rex", createdAt: "2026-03-01T09:00:00.000Z" }],
    logs: Array.from({ length: logs }, (_, index) => ({
      id: `l${index}`,
      dogId: "d1",
      score: 3 as const,
      color: null,
      flags: [],
      loggedAt: new Date(Date.parse("2026-03-01T09:00:00.000Z") + index * 60_000).toISOString(),
    })),
  };
}

function foreignWrite(store: Store): void {
  window.localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
}

beforeEach(() => {
  window.localStorage.clear();
  __resetCache();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  __resetCache();
});

/**
 * What a screen actually mounts: useStore for the record and useNow for the
 * reading every window is measured against. Both subscribe to the store, which
 * is what makes the cost of a subscription a per-screen cost rather than a
 * one-off.
 */
describe("subscribing to the store", () => {
  it("listens for a foreign write once, however many hooks are on the screen", () => {
    const added = vi.spyOn(window, "addEventListener");
    renderHook(() => ({ store: useStore(), now: useNow() }));

    expect(__listenerCount()).toBe(2);
    // One handler for the module, not one per subscriber: it is the handler
    // that drops the shared parse cache, so a second copy of it drops the
    // cache again after the first has already refilled it.
    expect(added.mock.calls.filter(([type]) => type === "storage")).toHaveLength(1);
  });

  it("parses the store once when a foreign write wakes every hook at once", () => {
    window.localStorage.setItem(KEY, JSON.stringify(persisted(3)));
    const { result } = renderHook(() => ({ store: useStore(), now: useNow() }));
    expect(result.current.store.logs).toHaveLength(3);

    // Counted from here, so the mount's own read is not in the total.
    const parsed = vi.spyOn(JSON, "parse");
    act(() => {
      foreignWrite(persisted(4));
    });

    expect(result.current.store.logs).toHaveLength(4);
    // The whole log list, through JSON.parse and then through the schema, once
    // per foreign write. A cache invalidated per subscriber instead made it
    // once per subscriber - and handed useSyncExternalStore a new object
    // identity for data that had not changed, so the extra parse came with an
    // extra render.
    expect(parsed).toHaveBeenCalledTimes(1);
  });

  it("stops listening for foreign writes once the last hook is gone", () => {
    const removed = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => ({ store: useStore(), now: useNow() }));

    unmount();

    expect(__listenerCount()).toBe(0);
    expect(removed.mock.calls.filter(([type]) => type === "storage")).toHaveLength(1);
  });
});
