// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ScoreChart } from "@/components/score-chart";
import { chartSeries } from "@/lib/trend";
import type { PoopLog } from "@/lib/types";

afterEach(cleanup);

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function log(id: string, agoMs: number, score: PoopLog["score"]): PoopLog {
  return {
    id,
    dogId: "d1",
    score,
    color: null,
    flags: [],
    loggedAt: new Date(NOW - agoMs).toISOString(),
  };
}

function draw(logs: readonly PoopLog[]) {
  return <ScoreChart series={chartSeries(logs, NOW)} label="test chart" />;
}

/** The transparent slices laid over the plot, in plot order. */
function hitTargets(container: HTMLElement): SVGRectElement[] {
  return [...container.querySelectorAll<SVGRectElement>('rect[fill="transparent"]')];
}

function caption(container: HTMLElement): string {
  return container.querySelector("figcaption")?.textContent ?? "";
}

describe("ScoreChart", () => {
  it("draws an empty state, not a chart, when there is nothing in the window", () => {
    const { container } = render(draw([log("old", 45 * DAY, 3)]));
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toContain("No data. Go outside.");
  });

  it("gives every point its own hit target, even two logs on the same day", () => {
    // A day is ~9.5 user units wide on a 30-day plot, so circular hit targets
    // big enough to tap overlapped here and the newer one covered the older.
    const { container } = render(draw([log("morning", DAY + 2 * HOUR, 2), log("evening", DAY, 6)]));
    const targets = hitTargets(container);
    expect(targets).toHaveLength(2);

    fireEvent.click(targets[0]);
    expect(caption(container)).toContain("Firm, segmented");

    fireEvent.click(targets[1]);
    expect(caption(container)).toContain("Shapeless mush");
  });

  it("tiles the hit targets edge to edge without overlapping", () => {
    const { container } = render(
      draw([log("a", 20 * DAY, 2), log("b", 10 * DAY, 3), log("c", DAY, 7)]),
    );
    const targets = hitTargets(container);
    expect(targets).toHaveLength(3);

    const edges = targets.map((rect) => ({
      left: Number(rect.getAttribute("x")),
      right: Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")),
    }));

    // Each slice starts exactly where the one before it ended: no overlap for
    // a later point to win, and no dead gap between them either.
    expect(edges.slice(1).map((edge) => edge.left)).toEqual(
      edges.slice(0, -1).map((edge) => edge.right),
    );
  });

  it("keeps the selection on the same log when an earlier one is deleted", () => {
    // Selecting by index meant a deletion shifted every later point under the
    // selection: the caption pointed at a neighbour, and selecting the newest
    // point left the index past the end of the array, throwing on the next
    // render - inside the error boundary this screen is supposed to be.
    const kept = log("kept", DAY, 7);
    const { container, rerender } = render(
      draw([log("oldest", 3 * DAY, 2), log("middle", 2 * DAY, 3), kept]),
    );

    fireEvent.click(hitTargets(container)[2]);
    expect(caption(container)).toContain("Watery puddle");

    rerender(draw([log("oldest", 3 * DAY, 2), kept]));
    expect(caption(container)).toContain("Watery puddle");
  });

  it("falls back to the legend when the selected log is deleted", () => {
    const doomed = log("doomed", DAY, 7);
    const { container, rerender } = render(draw([log("kept", 3 * DAY, 2), doomed]));

    fireEvent.click(hitTargets(container)[1]);
    expect(caption(container)).toContain("Watery puddle");

    rerender(draw([log("kept", 3 * DAY, 2)]));
    expect(caption(container)).toContain("Last 30 days");
  });
});
