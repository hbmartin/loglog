import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import type { FecalScore } from "@/lib/types";

/**
 * The seven Purina scores drawn rather than numbered.
 *
 * The real chart is illustrated, and the shapes carry the scale far faster
 * than the labels do: discrete pellets collapse into a single log, the log
 * sags, the sag slumps into a pile, the pile loses its edges, the edges go
 * entirely. Everything is one flat currentColor fill on a 24x24 grid so a
 * glyph inherits whatever the score ramp already decided about tone.
 *
 * Purely decorative - every glyph sits next to its own numeral and label, so
 * these are aria-hidden rather than titled.
 */
const GLYPHS: Record<FecalScore, ReactElement> = {
  // Four separate pellets: nothing touches.
  1: (
    <>
      <circle cx="7.6" cy="9.2" r="2.5" />
      <circle cx="15.4" cy="8.2" r="2.5" />
      <circle cx="11.4" cy="15.2" r="2.5" />
      <circle cx="18" cy="14.4" r="2.1" />
    </>
  ),
  // One log, still visibly in segments.
  2: (
    <>
      <rect x="2.6" y="9" width="5.4" height="6.2" rx="2.6" />
      <rect x="9.3" y="9" width="5.4" height="6.2" rx="2.6" />
      <rect x="16" y="9" width="5.4" height="6.2" rx="2.6" />
    </>
  ),
  // The namesake: one continuous log, segmentation gone.
  3: <rect x="2.6" y="8.9" width="18.8" height="6.4" rx="3.2" transform="rotate(-3 12 12)" />,
  // Still a log, but the middle has given up.
  4: (
    <path d="M3.4 11.2c1.9-2.6 4.6-3 8.6-3 4 0 6.9.5 8.6 3 1.5 2.2-.4 5.4-4.4 5.7-3.9.3-6.5.3-9 0-3.9-.5-5.3-3.5-3.8-5.7Z" />
  ),
  // No longer a log at all: a mound with a base.
  5: (
    <path d="M3.6 16.6c0-4.8 3.8-9.2 8.4-9.2s8.4 4.4 8.4 9.2c0 .9-.8 1.4-1.9 1.4H5.5c-1.1 0-1.9-.5-1.9-1.4Z" />
  ),
  // Texture without shape: a ragged mass plus what escaped it.
  6: (
    <>
      <path d="M4.9 13.6c-1.1-2.9 1.9-4.9 4.9-4.3 1.8-1.5 5-1.3 6.3.3 2.9-.2 5.1 1.9 4.2 4.2-.7 1.9-3.4 3-7.2 2.9-4.2-.1-7.4-1-8.2-3.1Z" />
      <circle cx="4.1" cy="17.5" r="1.15" />
      <circle cx="19.6" cy="17.1" r="0.95" />
      <circle cx="11.2" cy="18.8" r="0.85" />
    </>
  ),
  // Flat. Occurs as puddles.
  7: (
    <>
      <ellipse cx="12" cy="14.9" rx="9.2" ry="3.3" />
      <ellipse cx="4.6" cy="10" rx="1.7" ry="0.95" />
      <ellipse cx="19.2" cy="10.4" rx="2.1" ry="1.05" />
    </>
  ),
};

export function ScoreGlyph({
  score,
  className,
}: Readonly<{ score: FecalScore; className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("size-full", className)}
    >
      {GLYPHS[score]}
    </svg>
  );
}
