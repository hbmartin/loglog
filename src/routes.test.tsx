// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import { __resetCache } from "@/lib/storage";
import { __resetMetaCache } from "@/lib/meta";
import type { PoopLog, Store } from "@/lib/types";

/**
 * Route-level cover for the screens added around the grader. These mount the
 * real router against a seeded store, so they catch the things a pure unit
 * test cannot: a route that throws on mount, a link pointing at a path the
 * generated tree does not have, a summary that divides by zero.
 */

const DOG_ID = "dog-1";

function seed(logs: PoopLog[]): void {
  const store: Store = {
    version: 1,
    dogs: [{ id: DOG_ID, name: "Rufus", createdAt: new Date(2026, 0, 1).toISOString() }],
    logs,
  };
  window.localStorage.setItem("loglog:v1", JSON.stringify(store));
  __resetCache();
}

/**
 * Local midnight of the day in question. Noon would be in the future for any
 * run before midday, and a future log is deliberately ignored by the streak,
 * the chart and the summary alike.
 */
function log(id: string, daysAgo: number, score: PoopLog["score"]): PoopLog {
  const at = new Date();
  at.setDate(at.getDate() - daysAgo);
  at.setHours(0, 0, 0, 0);
  return { id, dogId: DOG_ID, score, color: null, flags: [], loggedAt: at.toISOString() };
}

function go(path: string) {
  window.history.pushState({}, "", path);
  return render(<RouterProvider router={getRouter()} />);
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    }),
  );
  vi.stubGlobal("scrollTo", vi.fn());
  window.localStorage.clear();
  __resetCache();
  __resetMetaCache();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("the dog page", () => {
  it("logs a score end to end and shows it in the record", async () => {
    seed([]);
    go(`/dog/${DOG_ID}`);

    await screen.findByRole("heading", { name: "Rufus" });
    expect(screen.getByText("The record is empty.")).toBeDefined();

    // The grader offers all seven, each carrying its Purina label.
    fireEvent.click(screen.getByRole("button", { name: /Log-like, moist/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enter into the record/ }));

    const history = within(screen.getByRole("region", { name: "The record" }));
    expect(history.getAllByText("Log-like, moist")).toHaveLength(1);
    expect(screen.queryByText("The record is empty.")).toBeNull();
  });

  it("keeps colour and findings behind a chosen score", async () => {
    seed([]);
    go(`/dog/${DOG_ID}`);

    await screen.findByRole("heading", { name: "Rufus" });
    expect(screen.queryByRole("button", { name: "Blood" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Watery puddle/ }));
    expect(screen.getByRole("button", { name: "Blood" })).toBeDefined();
    // The flags keep their plain clinical names whatever the copy elsewhere does.
    expect(screen.getByRole("button", { name: "Red streaks" })).toBeDefined();
  });

  it("shows the streak and the milestone shelf", async () => {
    seed([log("a", 0, 3), log("b", 1, 2)]);
    go(`/dog/${DOG_ID}`);

    await screen.findByRole("heading", { name: "Rufus" });
    expect(screen.getByText("Regularity")).toBeDefined();
    expect(screen.getByText("2 days")).toBeDefined();
    // A 3 is on file, so The Namesake is unlocked and Century is not.
    const shelf = within(screen.getByRole("region", { name: "Achievements" }));
    expect(shelf.getByText("The Namesake")).toBeDefined();
    // Century counts every entry, so two logs read as two of a hundred.
    expect(shelf.getByText("2 / 100")).toBeDefined();
  });
});

describe("wrapped", () => {
  it("summarises a year of logs", async () => {
    seed([log("a", 1, 3), log("b", 2, 3), log("c", 3, 7)]);
    go("/wrapped");

    await screen.findByRole("heading", { name: "loglog Wrapped" });
    // Two 3s and a 7: mean 4.33, two thirds of them inside the band, and the
    // signature score is the one the app is named after.
    expect(screen.getByText("4.33")).toBeDefined();
    expect(screen.getByText("A soft year. It happens.")).toBeDefined();
    expect(screen.getByText("67% inside the ideal 2–3 band")).toBeDefined();
    expect(screen.getByText("The namesake")).toBeDefined();
  });

  it("says so rather than dividing by zero when there is nothing to wrap", async () => {
    seed([]);
    go("/wrapped");

    await screen.findByRole("heading", { name: "loglog Wrapped" });
    expect(screen.getByText("Nothing to wrap. Log something first.")).toBeDefined();
  });
});

describe("the printable summary", () => {
  it("lists entries in Purina's own wording, oldest first", async () => {
    seed([log("older", 5, 2), log("newer", 1, 6)]);
    go(`/report/${DOG_ID}`);

    await screen.findByRole("heading", { name: "Purina fecal scoring summary" });

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Firm, segmented")).toBeDefined();
    expect(within(rows[1]).getByText("Shapeless mush")).toBeDefined();
  });

  it("carries no nicknames, milestones or register wording", async () => {
    window.localStorage.setItem("loglog:meta:v1", JSON.stringify({ register: "lab" }));
    __resetMetaCache();
    seed([log("a", 1, 3)]);
    go(`/report/${DOG_ID}`);

    await screen.findByRole("heading", { name: "Purina fecal scoring summary" });
    // The one screen a vet holds stays the same screen in either register.
    expect(screen.queryByText("The namesake")).toBeNull();
    expect(screen.queryByText("Case history")).toBeNull();
    expect(screen.getByText("Log-like, moist")).toBeDefined();
  });
});
