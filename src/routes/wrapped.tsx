import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ScoreGlyph } from "@/components/score-glyph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLexicon } from "@/lib/meta";
import { COLOR_INFO, scoreInfo } from "@/lib/purina";
import { useStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { hourLabel, loggedYears, wrapUp, type Wrapped } from "@/lib/wrapped";

export const Route = createFileRoute("/wrapped")({
  component: WrappedPage,
});

/** Which of the four verdicts the year's mean score earns. */
function verdictIndex(average: number): 0 | 1 | 2 | 3 {
  if (average < 2) return 0;
  if (average <= 3) return 1;
  if (average <= 4.5) return 2;
  return 3;
}

function WrappedPage() {
  const store = useStore();
  const copy = useLexicon();

  const years = useMemo(() => loggedYears(store), [store]);
  const [year, setYear] = useState<number | null>(null);
  const active = year ?? years[0] ?? new Date().getFullYear();
  const summary = useMemo(() => wrapUp(store, active), [store, active]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-12">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-2"
        render={
          <Link to="/">
            <ChevronLeft />
            {copy.allSubjects}
          </Link>
        }
      />

      <h1 className="font-display text-3xl font-semibold tracking-tight">{copy.wrappedHeading}</h1>
      <p className="text-muted-foreground font-display text-lg tabular-nums">{active}</p>

      {years.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {years.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === active ? "default" : "outline"}
              onClick={() => setYear(option)}
              className="tabular-nums"
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}

      {summary.total === 0 ? (
        <Card className="mt-6 p-6 text-center">
          <p className="text-muted-foreground text-sm">{copy.wrappedEmpty}</p>
        </Card>
      ) : (
        <Summary summary={summary} verdicts={copy.wrappedVerdicts} />
      )}
    </main>
  );
}

function Summary({
  summary,
  verdicts,
}: Readonly<{ summary: Wrapped; verdicts: readonly [string, string, string, string] }>) {
  const { topScore, topColor, busiestHour, busiestDay } = summary;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <Card className="from-primary/10 gap-1 bg-gradient-to-br to-transparent p-6 text-center">
        <p className="font-display text-6xl leading-none font-semibold tabular-nums">
          {summary.total}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {summary.total === 1 ? "entry" : "entries"} across {summary.dogs}{" "}
          {summary.dogs === 1 ? "dog" : "dogs"} and {summary.activeDays}{" "}
          {summary.activeDays === 1 ? "day" : "days"}
        </p>
      </Card>

      {summary.average === null ? null : (
        <Card className="gap-1 p-5 text-center">
          <p className="text-muted-foreground text-xs">Mean score</p>
          <p className="font-display text-4xl leading-none font-semibold tabular-nums">
            {summary.average.toFixed(2)}
          </p>
          <p className="mt-1 text-sm font-medium">{verdicts[verdictIndex(summary.average)]}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {Math.round(summary.idealShare * 100)}% inside the ideal 2–3 band
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {topScore === null ? null : (
          <Card className="gap-1 p-4">
            <p className="text-muted-foreground text-xs">Signature score</p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg p-1.5",
                  scoreInfo(topScore.value).badge,
                )}
              >
                <ScoreGlyph score={topScore.value} />
              </span>
              <span className="font-display text-2xl leading-none font-semibold tabular-nums">
                {topScore.value}
              </span>
            </div>
            <p className="text-xs font-medium italic">{scoreInfo(topScore.value).nickname}</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {topScore.count}× this year
            </p>
          </Card>
        )}

        {topColor === null ? null : (
          <Card className="gap-1 p-4">
            <p className="text-muted-foreground text-xs">House color</p>
            <span
              aria-hidden="true"
              className="swatch border-border size-9 rounded-full border"
              style={{ background: COLOR_INFO[topColor.value].swatch }}
            />
            <p className="text-xs font-medium">{COLOR_INFO[topColor.value].label}</p>
            <p className="text-muted-foreground text-xs tabular-nums">{topColor.count}× recorded</p>
          </Card>
        )}

        {busiestHour === null ? null : (
          <Card className="gap-1 p-4">
            <p className="text-muted-foreground text-xs">Peak hour</p>
            <p className="font-display text-2xl leading-none font-semibold">
              {hourLabel(busiestHour.value)}
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {busiestHour.count} {busiestHour.count === 1 ? "entry" : "entries"}
            </p>
          </Card>
        )}

        {busiestDay === null ? null : (
          <Card className="gap-1 p-4">
            <p className="text-muted-foreground text-xs">Biggest day</p>
            <p className="font-display text-2xl leading-none font-semibold">
              {new Date(`${busiestDay.value}T00:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {busiestDay.count} {busiestDay.count === 1 ? "entry" : "entries"}
            </p>
          </Card>
        )}

        <Card className="gap-1 p-4">
          <p className="text-muted-foreground text-xs">Longest ideal run</p>
          <p className="font-display text-2xl leading-none font-semibold tabular-nums">
            {summary.longestIdealRun}
          </p>
          <p className="text-muted-foreground text-xs">
            consecutive {summary.longestIdealRun === 1 ? "day" : "days"}
          </p>
        </Card>

        <Card className="gap-1 p-4">
          <p className="text-muted-foreground text-xs">Flagged entries</p>
          <p className="font-display text-2xl leading-none font-semibold tabular-nums">
            {summary.flagged}
          </p>
          <p className="text-muted-foreground text-xs">blood, mucus or worms</p>
        </Card>
      </div>

      {summary.perDog.length < 2 ? null : (
        <Card className="gap-2 p-4">
          <p className="text-muted-foreground text-xs">By dog</p>
          <ul className="flex flex-col gap-1.5">
            {summary.perDog.map((entry) => (
              <li key={entry.dog.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{entry.dog.name}</span>
                <span className="text-muted-foreground font-display shrink-0 tabular-nums">
                  {entry.total} · {entry.average.toFixed(1)} avg
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-muted-foreground mt-2 text-center text-xs">
        Computed on this device, from this device. Nothing was sent anywhere.
      </p>
    </div>
  );
}
