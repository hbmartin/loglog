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
 * The horizontal slice of the plot that selects each point: from halfway to
 * the previous point to halfway to the next, with the ends running out to the
 * plot edges. Circular hit targets large enough to tap overlap for anything
 * logged less than a day and a half apart, and the later circle paints over
 * the earlier one, so in daily use only the newest dot of a cluster can be
 * reached. Slices tile the plot instead: they never overlap, they leave no
 * dead space, and every point stays selectable however dense the data is.
 *
 * Points that land on the same x are handled as a run rather than one at a
 * time. Taking each one's own midpoints there would give the interior members
 * a slice of literally zero width - a <rect> with no area, which no pointer
 * can ever hit - and reinstate the unreachable middle dot this replaced. The
 * run splits its slice evenly instead, so a member is selectable even when
 * two logs land in the same millisecond.
 */
function hitBands(points: readonly ChartPoint[]): { id: string; x: number; width: number }[] {
  const bands: { id: string; x: number; width: number }[] = [];

  for (let start = 0; start < points.length;) {
    let end = start + 1;
    while (end < points.length && points[end].x === points[start].x) {
      end += 1;
    }

    // The neighbours outside the run, whose x values are strictly clear of it,
    // so the run's own slice always has width to divide.
    const previous = points[start - 1];
    const next = points[end];
    const left = previous === undefined ? 0 : (previous.x + points[start].x) / 2;
    const right = next === undefined ? 1 : (points[start].x + next.x) / 2;
    const step = (right - left) / (end - start);

    for (let index = start; index < end; index += 1) {
      const from = left + (index - start) * step;
      bands.push({ id: points[index].id, x: toX(from), width: toX(from + step) - toX(from) });
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
 * tap and once a minute as the clock moves. Its props are memoised to match:
 * without both halves each of those re-renders diffs the whole SVG subtree
 * for a chart that has not changed.
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
