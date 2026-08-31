import { memo, useId, useState } from "react";
import { useLexicon } from "@/lib/meta";
import { scoreInfo } from "@/lib/purina";
import type { ChartPoint, ChartSeries } from "@/lib/trend";
import { cn } from "@/lib/utils";

// User-space units. The SVG scales to its container; these only set the
// internal aspect ratio and the room reserved for axis labels.
const WIDTH = 320;
const PLOT_HEIGHT = 132;
const AXIS_BAND = 18;
// Room for the 1-7 scale labels down the left edge.
const PAD_LEFT = 24;
const PAD_RIGHT = 10;
const PAD_TOP = 8;

const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const HEIGHT = PLOT_HEIGHT + AXIS_BAND;

const toX = (x: number) => PAD_LEFT + x * PLOT_WIDTH;
const toY = (y: number) => PAD_TOP + y * (PLOT_HEIGHT - PAD_TOP * 2);

/**
 * The narrowest slice worth handing a fingertip, in user units. The SVG lays
 * 320 of them across a column that is 360-430 CSS px wide on a phone, so a
 * unit is a little over a pixel and this is around a tenth of an inch: not a
 * comfortable target, but the floor below which one stops existing in
 * practice.
 */
const MIN_HIT_WIDTH = 10;

/** The same distance in the 0-1 units the series is normalised to. */
const MIN_HIT_X = MIN_HIT_WIDTH / PLOT_WIDTH;

/**
 * The horizontal slice of the plot that selects each point: from halfway to
 * the previous point to halfway to the next, with the ends running out to the
 * plot edges. Circular hit targets large enough to tap overlap for anything
 * logged less than a day and a half apart, and the later circle paints over
 * the earlier one, so in daily use only the newest dot of a cluster can be
 * reached. Slices tile the plot instead: they never overlap and they leave no
 * dead space.
 *
 * Consecutive points closer together than MIN_HIT_X are handled as a run
 * sharing one slice, rather than one at a time. Their own midpoints would give
 * an interior member a slice as wide as the gap to its neighbours - for two
 * logs an hour apart on a thirty-day window, half a CSS pixel, which is a
 * <rect> no pointer can land on and the unreachable middle dot this replaced,
 * back again. Membership is measured from the previous member rather than from
 * whichever point opened the run, so it is the gaps that decide, and a point
 * left out of one keeps a slice of at least MIN_HIT_WIDTH: it is half a gap
 * from each neighbour, and both gaps are full width.
 *
 * What the run divides is a window only as wide as it needs - MIN_HIT_X per
 * member - laid over the run itself, with the slack on either side left to the
 * outermost members. Dividing the whole slice evenly instead puts the
 * boundaries wherever the neighbours outside happen to be: two logs a day
 * apart with a clear month behind them would split the plot down the middle,
 * and both dots would sit in the right-hand half, so the older one could only
 * be selected by tapping empty plot at the far left. That is the unreachable
 * dot again, by a longer route.
 *
 * It cannot promise MIN_HIT_WIDTH outright - thirty points on a thirty-day
 * window leave under 10 units each however they are cut, and a run pressed
 * against a plot edge gives its outermost member half a share so that the
 * boundaries between the rest can stay on their dots - nor that a dot in a
 * tight cluster falls inside its own band, which for three logs in one
 * afternoon is not geometrically possible. What it does promise is that the
 * bands are in plot order, adjacent to the dots they select, and none of them
 * is squeezed while a neighbour keeps a slice a hundred times wider.
 */
function hitBands(points: readonly ChartPoint[]): { id: string; x: number; width: number }[] {
  const bands: { id: string; x: number; width: number }[] = [];

  for (let start = 0; start < points.length;) {
    let end = start + 1;
    while (end < points.length && points[end].x - points[end - 1].x < MIN_HIT_X) {
      end += 1;
    }

    // The neighbours outside the run, whose x values are strictly clear of it,
    // so the run's own slice always has width to divide. Measured from the
    // first member on the left and the last on the right, so that every dot in
    // the run sits inside the span being divided.
    const previous = points[start - 1];
    const next = points[end];
    const left = previous === undefined ? 0 : (previous.x + points[start].x) / 2;
    const right = next === undefined ? 1 : (points[end - 1].x + next.x) / 2;

    const count = end - start;
    if (count === 1) {
      // Every point on a chart that is not a cluster, which is most of them:
      // the whole slice, and none of the division below to compute for it.
      bands.push({ id: points[start].id, x: toX(left), width: toX(right) - toX(left) });
      start = end;
      continue;
    }

    // Consecutive members are less than MIN_HIT_X apart, so the run's own
    // extent is always narrower than the window being divided, and the window
    // always sits over it. Where the slice is too narrow to give everyone
    // MIN_HIT_X, the window is the whole slice and every member takes an equal
    // share of it, which is the widest the narrowest band can be.
    const divided = Math.min(count * MIN_HIT_X, right - left);
    const step = divided / count;
    const centre = (points[start].x + points[end - 1].x) / 2;

    // What has to stay inside the slice is the boundaries between members,
    // not the window's own edges: the outermost members' bands run out to
    // `left` and `right` whatever the window does, so the boundaries are the
    // whole of what decides which dot belongs to which band. Held half a share
    // inside, they leave every band at least that wide - which is all the
    // outermost two need, and they do need it: the newest log sits exactly on
    // the plot's right edge whenever it was the last thing saved, and a band
    // clamped to that edge is a target with no area.
    //
    // Clamping the whole window inside the slice instead - a full share on
    // each side - drags every boundary a step off its dot as soon as a run
    // reaches a plot edge, which is where a run of daily logs always is. Four
    // of those ending today put each dot in its neighbour's band, and left the
    // oldest reachable only by tapping the empty left-hand four fifths of the
    // plot: the unreachable dot again, one edge further out.
    const margin = step / 2;
    const from = Math.min(Math.max(centre - divided / 2, left - margin), right - divided + margin);

    for (let index = start; index < end; index += 1) {
      const offset = index - start;
      // The outermost members absorb the slack out to the neighbours, which
      // keeps the bands tiling edge to edge.
      const bandLeft = offset === 0 ? left : from + offset * step;
      const bandRight = offset === count - 1 ? right : from + (offset + 1) * step;
      bands.push({
        id: points[index].id,
        x: toX(bandLeft),
        width: toX(bandRight) - toX(bandLeft),
      });
    }
    start = end;
  }

  return bands;
}

/** A diamond of circumradius `r` centred on (cx, cy). */
function diamond(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
}

/**
 * Purina score over the last 30 days, with the ideal 2-3 band shaded.
 *
 * One series, so no legend: the heading names what is plotted. The tooltip
 * only enhances - every value is also in the history list below, which is the
 * table view for this chart.
 *
 * Memoised because the page above re-renders on every score tap, every colour
 * tap, every flag toggle and every save confirmation that appears and expires
 * - none of which touch the plot - and its props are memoised to match:
 * without both halves each of those diffs the whole SVG subtree for a chart
 * that has not changed. The once-a-minute clock step is the one re-render
 * this does not catch, because `series` is derived from `now` and so is a
 * fresh object every tick. Quantising the clock for the chart alone would fix
 * that and cost more than the 0.007 px of geometry it saves.
 */
export const ScoreChart = memo(function ScoreChart({
  series,
  label,
  className,
}: Readonly<{ series: ChartSeries; label: string; className?: string }>) {
  const { points, ticks, band } = series;
  const copy = useLexicon();
  const titleId = useId();
  // Keyed by log id rather than index: deleting a log shifts every later
  // index, which would silently retarget a held selection at its neighbour
  // and, for the last point, leave the index pointing past the end.
  const [activeId, setActiveId] = useState<string | null>(null);

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "border-border text-muted-foreground flex h-24 items-end justify-center",
          "rounded-xl border border-dashed pb-3 text-sm",
          className,
        )}
      >
        {copy.chartEmpty}
      </div>
    );
  }

  const activePoint = points.find((point) => point.id === activeId) ?? null;

  return (
    <figure className={cn("m-0", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        // Uniform scaling: stretching would turn the dots into ellipses.
        className="h-auto w-full touch-manipulation"
        // An inline <svg> cannot be swapped for <img>; role="img" plus a
        // <title> is the accessible pattern for one.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="img"
        aria-labelledby={titleId}
        onPointerLeave={() => setActiveId(null)}
      >
        <title id={titleId}>{label}</title>

        {/* Ideal 2-3 band: a recessive reference area, not a data mark. */}
        <rect
          x={PAD_LEFT}
          y={toY(band.top)}
          width={PLOT_WIDTH}
          height={toY(band.bottom) - toY(band.top)}
          className="fill-muted"
        />

        {/* Names the reference area in place. Drawn before the marks, so a
            dot sitting on top of it always wins. */}
        <text
          x={WIDTH - PAD_RIGHT - 3}
          y={(toY(band.top) + toY(band.bottom)) / 2 + 3}
          textAnchor="end"
          className="fill-muted-foreground text-[8px] tracking-wide uppercase opacity-70"
        >
          {copy.idealBand}
        </text>

        {/* Only the ends of the scale are labelled; the band anchors the rest. */}
        {[
          { score: 7, y: 0 },
          { score: 1, y: 1 },
        ].map(({ score, y }) => (
          <text
            key={score}
            x={PAD_LEFT - 7}
            y={toY(y) + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[9px] tabular-nums"
          >
            {score}
          </text>
        ))}

        {/* Hairline, solid, one step off the surface. */}
        {ticks.map((tick) => (
          <line
            key={tick.x}
            x1={toX(tick.x)}
            x2={toX(tick.x)}
            y1={PAD_TOP}
            y2={PLOT_HEIGHT - PAD_TOP}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}

        {points.length > 1 ? (
          <polyline
            points={points.map((p) => `${toX(p.x)},${toY(p.y)}`).join(" ")}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Ideal reads as a circle, off-ideal as a diamond. The ramp in
            purina.ts runs amber - emerald - red, which is the one pair of hues
            a red/green-deficient reader cannot separate, and the shaded band
            is too low-contrast to carry the distinction on its own. Shape
            survives both, and greyscale printing with it. */}
        {points.map((point) => {
          const cx = toX(point.x);
          const cy = toY(point.y);
          // A diamond of the same circumradius covers a third less area, so it
          // is drawn a step larger to read at the same weight as a circle.
          const r = point.id === activeId ? 5 : 4;
          const fill = scoreInfo(point.score).dot;
          return (
            <g key={point.id}>
              {/* 2px surface ring keeps marks legible where they overlap. */}
              {point.ideal ? (
                <circle cx={cx} cy={cy} r={6} className="fill-background" />
              ) : (
                <path d={diamond(cx, cy, 7.5)} className="fill-background" />
              )}
              {point.ideal ? (
                <circle cx={cx} cy={cy} r={r} className={fill} />
              ) : (
                <path d={diamond(cx, cy, r + 1.5)} className={fill} />
              )}
            </g>
          );
        })}

        {ticks.map((tick, index) => (
          <text
            key={tick.x}
            x={toX(tick.x)}
            y={HEIGHT - 5}
            textAnchor={index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-[9px] tabular-nums"
          >
            {tick.label}
          </text>
        ))}

        {/* Last, so these win the hit test over the marks they cover. */}
        {hitBands(points).map((hit) => (
          <rect
            key={hit.id}
            x={hit.x}
            y={PAD_TOP}
            width={hit.width}
            height={PLOT_HEIGHT - PAD_TOP * 2}
            fill="transparent"
            className="cursor-pointer"
            onPointerEnter={() => setActiveId(hit.id)}
            onClick={() => setActiveId(hit.id)}
          />
        ))}
      </svg>

      <figcaption className="text-muted-foreground mt-1 min-h-8 text-xs" aria-live="polite">
        {activePoint === null ? (
          <span>{copy.chartLegend}</span>
        ) : (
          <span className="text-foreground font-medium">
            {new Date(activePoint.loggedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}{" "}
            &middot; {activePoint.score} &middot; {scoreInfo(activePoint.score).label}
            {activePoint.ideal ? null : ` · ${copy.outsideBand}`}
          </span>
        )}
      </figcaption>
    </figure>
  );
});
