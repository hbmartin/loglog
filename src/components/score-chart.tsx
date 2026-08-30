import { useId, useState } from "react";
import { scoreInfo } from "@/lib/purina";
import type { ChartSeries } from "@/lib/trend";

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
 * Purina score over the last 30 days, with the ideal 2-3 band shaded.
 *
 * One series, so no legend: the heading names what is plotted. The tooltip
 * only enhances - every value is also in the history list below, which is the
 * table view for this chart.
 */
export function ScoreChart({ series, label }: Readonly<{ series: ChartSeries; label: string }>) {
  const { points, ticks, band } = series;
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) {
    return null;
  }

  const activePoint = active === null ? null : points[active];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        // Uniform scaling: stretching would turn the dots into ellipses.
        className="h-auto w-full touch-manipulation"
        // An inline <svg> cannot be swapped for <img>; role="img" plus a
        // <title> is the accessible pattern for one.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="img"
        aria-labelledby={titleId}
        onPointerLeave={() => setActive(null)}
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

        {points.map((point, index) => (
          <g key={point.loggedAt + String(index)}>
            {/* 2px surface ring keeps dots legible where they overlap. */}
            <circle cx={toX(point.x)} cy={toY(point.y)} r={6} className="fill-background" />
            <circle
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={4}
              className={point.ideal ? "fill-primary" : "fill-destructive"}
            />
            {/* Hit target well above the 4px mark, per interaction specs. */}
            <circle
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={12}
              fill="transparent"
              className="cursor-pointer"
              onPointerEnter={() => setActive(index)}
              onClick={() => setActive(index)}
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
      </svg>

      <figcaption className="text-muted-foreground mt-1 min-h-8 text-xs" aria-live="polite">
        {activePoint === null ? (
          <span>
            Last 30 days, 7 (loosest) down to 1. The shaded band is the ideal 2&ndash;3 range.
          </span>
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
