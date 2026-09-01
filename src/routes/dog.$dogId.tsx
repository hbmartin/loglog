import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Download, Printer, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AchievementShelf } from "@/components/achievement-shelf";
import { Centennial } from "@/components/centennial";
import { PlopButton } from "@/components/plop-button";
import { ScoreBadge } from "@/components/score-badge";
import { ScoreChart } from "@/components/score-chart";
import { ScoreGlyph } from "@/components/score-glyph";
import { achievements } from "@/lib/achievements";
import { useNow } from "@/lib/clock";
import { buildCsv, csvFilename, downloadCsv } from "@/lib/csv";
import { markExported, useLexicon, useMeta } from "@/lib/meta";
import { COLOR_INFO, FLAG_LABELS, PURINA_SCALE, scoreInfo } from "@/lib/purina";
import { addLog, deleteLog, findDog, logsForDog, useStore } from "@/lib/storage";
import { chartSeries, regularity, summarise, timeAgo, timeOfDayNote } from "@/lib/trend";
import { cn } from "@/lib/utils";
import {
  POOP_COLORS,
  POOP_FLAGS,
  type FecalScore,
  type PoopColor,
  type PoopFlag,
} from "@/lib/types";

export const Route = createFileRoute("/dog/$dogId")({
  component: DogPage,
});

/** The one entry that earns a flourish. */
const CENTENNIAL = 100;

/** How long the save confirmation and the centennial flourish stay up. */
const TOAST_MS = 2600;
const CENTENNIAL_MS = 1800;

function DogPage() {
  const { dogId } = Route.useParams();
  const store = useStore();
  const meta = useMeta();
  const copy = useLexicon();
  const dog = findDog(store, dogId);

  const [score, setScore] = useState<FecalScore | null>(null);
  const [color, setColor] = useState<PoopColor | null>(null);
  const [flags, setFlags] = useState<PoopFlag[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [centennial, setCentennial] = useState(false);

  // Both flourishes are on a timer, and saves arrive faster than those
  // timers expire. Without a handle to cancel, the countdown from the
  // previous save clears the toast a fraction of a second after the new one
  // appeared; keeping the handles also stops a navigation mid-countdown
  // firing into an unmounted page.
  const toastTimer = useRef<number | null>(null);
  const centennialTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
      if (centennialTimer.current !== null) {
        window.clearTimeout(centennialTimer.current);
      }
    },
    [],
  );

  // store is referentially stable between writes and `now` steps once a
  // minute, so these recompute when the data actually changes rather than on
  // every score tap, colour tap or toggle of the confirmation. ScoreChart is
  // memoised on `series` and `label`, so a fresh object for either would
  // re-reconcile every dot, gridline and label in the SVG.
  const logs = useMemo(() => (dog === undefined ? [] : logsForDog(store, dog.id)), [store, dog]);

  // Every window below is measured from `now` rather than from each helper's
  // own Date.now() default. Memoised on the logs alone, that default is
  // captured at whatever moment the log list last changed and then frozen: an
  // app left open overnight would still be counting an eight-day-old entry as
  // "past 7 days", and only adding or deleting a log would move it.
  const now = useNow();

  // What the record holds, read once for every gate on the screen. The
  // summary's empty state, the history list, the export button and the report
  // link all answer the same question - is there anything on file at all - and
  // answering it twice is how the summary came to say "No logs yet" directly
  // above a populated history: it was keyed on the logs that have happened,
  // which a single entry dated in the future leaves at none, while the three
  // below stayed on the record itself.
  const onFile = logs.length;

  const trend = useMemo(() => summarise(logs, now), [logs, now]);
  const series = useMemo(() => chartSeries(logs, now), [logs, now]);
  const streak = useMemo(() => regularity(logs, now), [logs, now]);
  const earned = useMemo(
    () => achievements(logs, { exported: meta.exportedAt !== null }, now),
    [logs, meta.exportedAt, now],
  );

  // Hooks run before the notFound throw below, so this has to tolerate a dog
  // that does not exist; the empty label is never rendered.
  //
  // Plain clinical wording in either register, per the note at the top of
  // lexicon.ts - a screen reader user should not have to decode a bit. The one
  // exception is the heading it sends them to, which has to be the name that
  // is actually on the page.
  const dogName = dog?.name;
  const historyHeading = copy.historyHeading;
  const label = useMemo(() => {
    if (dogName === undefined) {
      return "";
    }
    // Counted here rather than in a memo of its own: it is derived from
    // `series` and used nowhere else, so a separate memo only adds a
    // dependency that can never invalidate on its own.
    const offIdeal = series.points.filter((point) => !point.ideal).length;
    const logged = `${series.points.length} ${series.points.length === 1 ? "log" : "logs"}`;
    return `${dogName}: Purina fecal score over the last 30 days. ${logged}, ${offIdeal} outside the ideal 2–3 range. Every entry is listed under ${historyHeading}, below.`;
  }, [dogName, series, historyHeading]);

  if (dog === undefined) {
    throw notFound();
  }

  const toggleFlag = (flag: PoopFlag) => {
    setFlags((current) =>
      current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag],
    );
  };

  const save = () => {
    if (score === null) {
      return;
    }
    const saved = addLog({ dogId: dog.id, score, color, flags });
    setScore(null);
    setColor(null);
    setFlags([]);

    // The aside is about the clock, never the score: there is no hour of the
    // night at which a joke about a 7 is welcome.
    const note = timeOfDayNote(saved.loggedAt);
    const line = copy.toasts[Math.floor(Math.random() * copy.toasts.length)];
    setToast(note === null ? line : `${line} ${note}`);
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, TOAST_MS);

    if (logs.length + 1 === CENTENNIAL) {
      setCentennial(true);
      if (centennialTimer.current !== null) {
        window.clearTimeout(centennialTimer.current);
      }
      centennialTimer.current = window.setTimeout(() => {
        centennialTimer.current = null;
        setCentennial(false);
      }, CENTENNIAL_MS);
    }
  };

  const exportOne = () => {
    downloadCsv(buildCsv(store, [dog]), csvFilename(dog.name));
    markExported();
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-12">
      <Centennial show={centennial} />

      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link to="/">
              <ChevronLeft />
              {copy.allSubjects}
            </Link>
          }
        />
        {onFile === 0 ? null : (
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link to="/report/$dogId" params={{ dogId: dog.id }}>
                <Printer />
                {copy.reportLink}
              </Link>
            }
          />
        )}
      </div>

      <h1 className="font-display text-2xl font-semibold tracking-tight">{dog.name}</h1>

      <TrendSummary trend={trend} onFile={onFile} streak={streak} now={now} />

      <ScoreChart className="mt-4" series={series} label={label} />

      <Separator className="my-5" />

      <section aria-labelledby="grade-heading">
        <h2 id="grade-heading" className="mb-1 font-semibold">
          {copy.gradeHeading}
        </h2>
        <p className="text-muted-foreground mb-3 text-sm">{copy.gradeHelp}</p>

        <div className="flex flex-col gap-2">
          {PURINA_SCALE.map((info) => {
            const selected = score === info.score;
            return (
              <button
                key={info.score}
                type="button"
                aria-pressed={selected}
                onClick={() => setScore(selected ? null : info.score)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg p-1.5",
                    selected ? "bg-primary-foreground/15" : info.badge,
                  )}
                >
                  <ScoreGlyph score={info.score} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    <span className="font-display mr-1.5 font-semibold tabular-nums">
                      {info.score}
                    </span>
                    {info.label}
                    {info.ideal ? (
                      <span
                        className={cn(
                          "ml-1.5 text-xs font-normal",
                          selected
                            ? "text-primary-foreground/70"
                            : "text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        ideal
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "block text-xs italic",
                      selected ? "text-primary-foreground/80" : "text-foreground/70",
                    )}
                  >
                    {info.nickname}
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      selected ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {info.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {score === null ? null : (
        <>
          <section aria-labelledby="color-heading" className="mt-6">
            <h2 id="color-heading" className="mb-2 font-semibold">
              {copy.colorHeading}{" "}
              <span className="text-muted-foreground text-sm font-normal">{copy.optional}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {POOP_COLORS.map((key) => {
                const info = COLOR_INFO[key];
                const selected = color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={info.label}
                    title={info.label}
                    onClick={() => setColor(selected ? null : key)}
                    className={cn(
                      "swatch size-11 rounded-full border-2 transition-all",
                      selected
                        ? "border-foreground scale-110"
                        : "border-border hover:border-foreground/40",
                    )}
                    style={{ background: info.swatch }}
                  />
                );
              })}
            </div>
            {color === null ? null : (
              <p className="text-muted-foreground mt-2 text-sm">
                {COLOR_INFO[color].label}
                {COLOR_INFO[color].concerning ? " — worth mentioning to a vet" : ""}
              </p>
            )}
          </section>

          <section aria-labelledby="flags-heading" className="mt-6">
            <h2 id="flags-heading" className="mb-2 font-semibold">
              {copy.flagsHeading}{" "}
              <span className="text-muted-foreground text-sm font-normal">{copy.optional}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {POOP_FLAGS.map((flag) => {
                const selected = flags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleFlag(flag)}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                      selected
                        ? "border-destructive bg-destructive/15 text-destructive"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {FLAG_LABELS[flag]}
                  </button>
                );
              })}
            </div>
          </section>

          <PlopButton className="mt-6" onPlop={save}>
            {copy.logIt}
          </PlopButton>
        </>
      )}

      {toast === null ? null : (
        <output className="mt-3 block text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {toast}
        </output>
      )}

      <Separator className="my-6" />

      <AchievementShelf
        items={earned}
        heading={copy.achievementsHeading}
        help={copy.achievementsHelp}
      />

      <Separator className="my-6" />

      <section aria-labelledby="history-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="history-heading" className="font-semibold">
            {copy.historyHeading}
          </h2>
          {onFile === 0 ? null : (
            <Button variant="ghost" size="sm" onClick={exportOne}>
              <Download />
              {copy.exportOne}
            </Button>
          )}
        </div>

        {onFile === 0 ? (
          <p className="text-muted-foreground text-sm">{copy.historyEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {logs.map((log) => (
              <li key={log.id}>
                <Card className="flex flex-row items-center gap-3 p-3">
                  <ScoreBadge score={log.score} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{scoreInfo(log.score).label}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(log.loggedAt).toLocaleString()} · {timeAgo(log.loggedAt, now)}
                    </p>
                  </div>
                  {log.color === null ? null : (
                    <span
                      aria-label={COLOR_INFO[log.color].label}
                      title={COLOR_INFO[log.color].label}
                      className="swatch border-border size-5 shrink-0 rounded-full border"
                      style={{ background: COLOR_INFO[log.color].swatch }}
                    />
                  )}
                  {log.flags.length === 0 ? null : (
                    <span className="text-destructive shrink-0 text-xs font-medium">
                      {log.flags.map((f) => FLAG_LABELS[f]).join(", ")}
                    </span>
                  )}
                  <DeleteLogButton onConfirm={() => deleteLog(log.id)} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * `onFile` is every entry the record holds, which is what the history list,
 * the export and the report link below are all gated on; `trend` describes the
 * subset that has happened. The empty state is a statement about the record,
 * so it belongs to the first: keyed on the second, a single log dated in the
 * future - a phone whose clock ran ahead when a score was saved - put "No logs
 * yet" directly above a populated history, with the export button and the
 * report link beside it. A record with nothing in it that has happened yet
 * gets the dashes and zeroes instead, which is the same thing the chart under
 * it and every milestone say.
 */
function TrendSummary({
  trend,
  onFile,
  streak,
  now,
}: Readonly<{
  trend: ReturnType<typeof summarise>;
  onFile: number;
  streak: number;
  now: number;
}>) {
  const copy = useLexicon();

  if (onFile === 0) {
    return <p className="text-muted-foreground mt-1 text-sm">No logs yet — pick a score below.</p>;
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Stat
        label={copy.statLast}
        value={trend.lastLoggedAt === null ? "—" : timeAgo(trend.lastLoggedAt, now)}
      />
      <Stat label={copy.statWeek} value={String(trend.lastWeek)} />
      <Stat
        label={copy.statMean}
        hint={copy.statMeanHint}
        value={trend.average === null ? "—" : trend.average.toFixed(1)}
        warn={trend.offIdeal > 0}
      />
      <Stat
        label={copy.regularity}
        value={`${streak} ${streak === 1 ? copy.regularityUnitOne : copy.regularityUnit}`}
      />
      {trend.offIdeal > 0 ? (
        <p className="text-muted-foreground col-span-2 text-xs">
          {trend.offIdeal} of {trend.lastWeek} in the past week fell outside the ideal 2–3 band.
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  warn = false,
}: Readonly<{ label: string; value: string; hint?: string; warn?: boolean }>) {
  return (
    <Card className="gap-0 p-3" title={hint}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "font-display truncate text-base font-semibold",
          warn ? "text-destructive" : undefined,
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function DeleteLogButton({ onConfirm }: Readonly<{ onConfirm: () => void }>) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete this log"
            className="text-muted-foreground shrink-0"
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this log?</AlertDialogTitle>
          <AlertDialogDescription>
            This can't be undone. The entry is only stored on this device.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
