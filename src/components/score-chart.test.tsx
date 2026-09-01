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

/**
 * The dot centres in user units, read out of the polyline the component draws
 * through them rather than recomputed here - the point of these cases is where
 * the slices sit relative to what is painted, so the two have to come from the
 * same geometry.
 */
function dotXs(container: HTMLElement): number[] {
  const drawn = container.querySelector("polyline")?.getAttribute("points") ?? "";
  return drawn.split(" ").map((pair) => Number(pair.split(",")[0]));
}

/**
 * The index of the slice a tap at user-space `x` lands in, or -1.
 *
 * Scanned from the end, which is how the browser resolves it: the slices tile
 * edge to edge, so a tap exactly on a shared boundary is inside two rects at
 * once and the one painted later - drawn in plot order, so the higher index -
 * takes the hit. Scanning forwards would score such a tap as selecting the
 * older log while the app selects the newer, and the cases below would pass on
 * geometry the product gets wrong.
 */
function bandAt(targets: readonly SVGRectElement[], x: number): number {
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const left = Number(targets[index].getAttribute("x"));
    if (x >= left && x <= left + Number(targets[index].getAttribute("width"))) {
      return index;
    }
  }
  return -1;
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

  it("puts each dot in the slice that selects it", () => {
    // Two logs a day apart with a clear month behind them. Widening the run
    // rule to "too close to tap" without moving the divided window with it
    // split the plot down the middle: one rect per point, in the right order,
    // both of them nowhere near a dot. Every tap on either visible dot
    // selected the newer log, and the older one could only be reached by
    // tapping empty plot at the far left - the unreachable dot the slices
    // exist to prevent, back again.
    const { container } = render(draw([log("morning", DAY + 2 * HOUR, 2), log("evening", DAY, 6)]));
    const targets = hitTargets(container);

    dotXs(container).forEach((x, index) => {
      expect(bandAt(targets, x)).toBe(index);
    });

    fireEvent.click(targets[bandAt(targets, dotXs(container)[0])]);
    expect(caption(container)).toContain("Firm, segmented");
  });

  it("keeps every dot in its own slice for a run of daily logs", () => {
    // A day is a shade under MIN_HIT_X on a thirty-day plot, so consecutive
    // days are one run - and a run ending today sits hard against the plot's
    // right edge. Clamping the divided window inside the run's slice there
    // shifted every boundary a step to the left: each dot landed in its
    // neighbour's band, so tapping yesterday selected today, and the oldest of
    // the four could only be reached by tapping the empty left-hand four
    // fifths of the plot. This is the app's ordinary state, not an edge case.
    const { container } = render(
      draw([log("d3", 3 * DAY, 2), log("d2", 2 * DAY, 3), log("d1", DAY, 6), log("today", 0, 7)]),
    );
    const targets = hitTargets(container);
    expect(targets).toHaveLength(4);

    dotXs(container).forEach((x, index) => {
      expect(bandAt(targets, x)).toBe(index);
    });

    fireEvent.click(targets[0]);
    expect(caption(container)).toContain("Firm, segmented");
  });

  it("does not shrink the newest dot's slice to reach the plot edge", () => {
    // The same run of daily logs. The newest dot sits exactly on the plot's
    // right edge whenever it was the last thing saved, so its slice can only
    // grow leftwards - and holding the divided window a fixed half share
    // inside the run's own slice left it with half of MIN_HIT_WIDTH, five user
    // units, on the most-tapped dot on the chart, while the dot beside it kept
    // a full share and the oldest of the four kept nine tenths of the plot.
    // What the boundary between the last two actually needs is to clear the
    // older of them; the slack goes to the band with a plot edge to absorb it.
    const { container } = render(
      draw([log("d3", 3 * DAY, 2), log("d2", 2 * DAY, 3), log("d1", DAY, 6), log("today", 0, 7)]),
    );
    const widths = hitTargets(container).map((rect) => Number(rect.getAttribute("width")));

    expect(widths[3]).toBeGreaterThan(7);
    // And not out of its neighbours' share: the interior bands still get the
    // whole of MIN_HIT_WIDTH each, float noise aside.
    expect(widths[1]).toBeGreaterThan(9.99);
    expect(widths[2]).toBeGreaterThan(9.99);
  });

  it("keeps every dot in its own slice at the oldest edge too", () => {
    // The same run against the other end of the window, where the clamp ran
    // the other way and put the two oldest dots in one band.
    const { container } = render(
      draw([
        log("a", 30 * DAY, 2),
        log("b", 29 * DAY, 3),
        log("c", 28 * DAY, 6),
        log("later", 10 * DAY, 7),
      ]),
    );
    const targets = hitTargets(container);
    expect(targets).toHaveLength(4);

    dotXs(container).forEach((x, index) => {
      expect(bandAt(targets, x)).toBe(index);
    });
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

  it("keeps every point selectable when two logs land on the same instant", () => {
    // Identical timestamps collapse onto one x. Taking each point's own
    // midpoints there hands the interior of the run a zero-width rect, which
    // has no area for a pointer to land on: the middle dot of a cluster
    // became unreachable again, which is the failure slices exist to prevent.
    const { container } = render(
      draw([log("first", DAY, 2), log("second", DAY, 7), log("later", 0, 6)]),
    );
    const targets = hitTargets(container);
    expect(targets).toHaveLength(3);
    expect(targets.map((rect) => Number(rect.getAttribute("width")))).not.toContain(0);

    fireEvent.click(targets[0]);
    expect(caption(container)).toContain("Firm, segmented");

    fireEvent.click(targets[1]);
    expect(caption(container)).toContain("Watery puddle");
  });

  it("splits a cluster's slice rather than handing its middle a sliver", () => {
    // Three logs across one afternoon, ten days into the window with clear
    // air on either side. Their own midpoints gave the middle one a band the
    // width of an hour - 0.4 user units, half a CSS pixel on a phone, a
    // <rect> no finger can land on - while its neighbours kept a fortnight
    // each. Keying the run on exact equality of x never caught it: an hour
    // apart is not the same instant, it is just too close to tap.
    const { container } = render(
      draw([
        log("last week", 20 * DAY, 2),
        log("after lunch", 10 * DAY + 2 * HOUR, 3),
        log("teatime", 10 * DAY + HOUR, 6),
        log("evening", 10 * DAY, 7),
      ]),
    );
    const targets = hitTargets(container);
    const widths = targets.map((rect) => Number(rect.getAttribute("width")));
    expect(widths).toHaveLength(4);
    // MIN_HIT_WIDTH is 10 user units, and a cluster gets exactly that each;
    // the slack is float noise, not a fourth significant digit of intent.
    expect(Math.min(...widths)).toBeGreaterThan(9.99);

    // And the afternoon's three slices sit over the afternoon rather than
    // spreading across the plot: a tap anywhere on the cluster lands in one of
    // them, never in last week's. Not each dot in its own - three logs an hour
    // apart are closer together than a fingertip, so no division of the slice
    // can separate them, which is why this is the one run the cases above do
    // not ask that of.
    const dots = dotXs(container);
    expect(bandAt(targets, dots[0])).toBe(0);
    for (const x of dots.slice(1)) {
      expect(bandAt(targets, x)).toBeGreaterThan(0);
    }

    // Still one slice per log, still in plot order, each selecting its own.
    fireEvent.click(targets[2]);
    expect(caption(container)).toContain("Shapeless mush");
  });

  it("marks off-ideal points by shape as well as colour", () => {
    // The score ramp runs amber - emerald - red, so colour alone leaves a
    // red/green-deficient reader, and any greyscale print, unable to tell
    // which entries fell outside the band. Circle for ideal, diamond for not.
    const { container } = render(draw([log("ideal", 3 * DAY, 3), log("off", DAY, 6)]));
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelectorAll("path")).toHaveLength(2);
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
