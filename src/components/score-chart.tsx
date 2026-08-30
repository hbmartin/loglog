import { useId, useState } from "react";
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
 */
function hitBands(points: readonly ChartPoint[]): { id: string; x: number; width: number }[] {
  return points.map((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    const left = previous === undefined ? 0 : (previous.x + point.x) / 2;
    const right = next === undefined ? 1 : (point.x + next.x) / 2;
    return { id: point.id, x: toX(left), width: toX(right) - toX(left) };
  });
}

/**
 * Purina score over the last 30 days, with the ideal 2-3 band shaded.
 *
 * One series, so no legend: the heading names what is plotted. The tooltip
 * only enhances - every value is also in the history list below, which is the
 * table view for this chart.
 */
export function ScoreChart({
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

        {points.map((point) => (
          <g key={point.id}>
            {/* 2px surface ring keeps dots legible where they overlap. */}
            <circle cx={toX(point.x)} cy={toY(point.y)} r={6} className="fill-background" />
            <circle
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={point.id === activeId ? 5 : 4}
              className={scoreInfo(point.score).dot}
            />
          </g>
        ))}

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
          </span>
        )}
      </figcaption>
    </figure>
  );
}
