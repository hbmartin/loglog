import { scoreInfo } from "@/lib/purina";
import { ScoreGlyph } from "@/components/score-glyph";
import { cn } from "@/lib/utils";
import type { FecalScore } from "@/lib/types";

/**
 * A score at a glance: the drawn shape, the numeral, and a tone from the
 * diverging ramp in purina.ts. One component so a badge in the history list
 * and a badge on the dog list can never disagree about what a 6 looks like.
 *
 * The numeral is the accessible content; the glyph beside it is decorative.
 */
export function ScoreBadge({
  score,
  className,
}: Readonly<{ score: FecalScore; className?: string }>) {
  const info = scoreInfo(score);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1",
        "font-display text-sm leading-none font-semibold tabular-nums",
        info.badge,
        className,
      )}
    >
      <ScoreGlyph score={score} className="size-4" />
      {score}
    </span>
  );
}
