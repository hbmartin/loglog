import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Download, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buildCsv, csvFilename, downloadCsv } from "@/lib/csv";
import {
  COLOR_INFO,
  FLAG_LABELS,
  PURINA_SCALE,
  scoreInfo,
} from "@/lib/purina";
import { addLog, deleteLog, findDog, logsForDog, useStore } from "@/lib/storage";
import { summarise, timeAgo } from "@/lib/trend";
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

function DogPage() {
  const { dogId } = Route.useParams();
  const store = useStore();
  const dog = findDog(store, dogId);

  const [score, setScore] = useState<FecalScore | null>(null);
  const [color, setColor] = useState<PoopColor | null>(null);
  const [flags, setFlags] = useState<PoopFlag[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  if (dog === undefined) {
    throw notFound();
  }

  const logs = logsForDog(store, dog.id);
  const trend = summarise(logs);

  const toggleFlag = (flag: PoopFlag) => {
    setFlags((current) =>
      current.includes(flag)
        ? current.filter((f) => f !== flag)
        : [...current, flag]
    );
  };

  const save = () => {
    if (score === null) {
      return;
    }
    addLog({ dogId: dog.id, score, color, flags });
    setScore(null);
    setColor(null);
    setFlags([]);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-12">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-2"
        render={
          <Link to="/">
            <ChevronLeft />
            All dogs
          </Link>
        }
      />

      <h1 className="text-2xl font-bold tracking-tight">{dog.name}</h1>

      <TrendSummary trend={trend} lastLoggedAt={logs[0]?.loggedAt} />

      <Separator className="my-5" />

      <section aria-labelledby="grade-heading">
        <h2 id="grade-heading" className="mb-1 font-semibold">
          How was it?
        </h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Purina fecal score. 2–3 is ideal.
        </p>

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
                    : "border-border bg-card hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold tabular-nums",
                    selected
                      ? "bg-primary-foreground/15"
                      : info.ideal
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted"
                  )}
                >
                  {info.score}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {info.label}
                    {info.ideal ? (
                      <span
                        className={cn(
                          "ml-1.5 text-xs font-normal",
                          selected
                            ? "text-primary-foreground/70"
                            : "text-emerald-700 dark:text-emerald-400"
                        )}
                      >
                        ideal
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      selected
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
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
              Color <span className="text-muted-foreground text-sm font-normal">(optional)</span>
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
                      "size-11 rounded-full border-2 transition-all",
                      selected
                        ? "border-foreground scale-110"
                        : "border-border hover:border-foreground/40"
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
              Anything in it?{" "}
              <span className="text-muted-foreground text-sm font-normal">(optional)</span>
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
                        : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    {FLAG_LABELS[flag]}
                  </button>
                );
              })}
            </div>
          </section>

          <Button className="mt-6 w-full" size="lg" onClick={save}>
            Log it
          </Button>
        </>
      )}

      {justSaved ? (
        <p
          role="status"
          className="mt-3 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          Logged.
        </p>
      ) : null}

      <Separator className="my-6" />

      <section aria-labelledby="history-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="history-heading" className="font-semibold">
            History
          </h2>
          {logs.length === 0 ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadCsv(buildCsv(store, [dog]), csvFilename(dog.name))
              }
            >
              <Download />
              CSV
            </Button>
          )}
        </div>

        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {logs.map((log) => (
              <li key={log.id}>
                <Card className="flex flex-row items-center gap-3 p-3">
                  <Badge
                    variant={scoreInfo(log.score).ideal ? "secondary" : "destructive"}
                  >
                    {log.score}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {scoreInfo(log.score).label}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(log.loggedAt).toLocaleString()} ·{" "}
                      {timeAgo(log.loggedAt)}
                    </p>
                  </div>
                  {log.color === null ? null : (
                    <span
                      aria-label={COLOR_INFO[log.color].label}
                      title={COLOR_INFO[log.color].label}
                      className="border-border size-5 shrink-0 rounded-full border"
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

function TrendSummary({
  trend,
  lastLoggedAt,
}: Readonly<{
  trend: ReturnType<typeof summarise>;
  lastLoggedAt: string | undefined;
}>) {
  if (trend.total === 0) {
    return (
      <p className="text-muted-foreground mt-1 text-sm">
        No logs yet — pick a score below.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <Stat
        label="Last"
        value={lastLoggedAt === undefined ? "—" : timeAgo(lastLoggedAt)}
      />
      <Stat label="Past 7 days" value={String(trend.lastWeek)} />
      <Stat
        label="Avg score"
        value={trend.average === null ? "—" : trend.average.toFixed(1)}
        warn={trend.offIdeal > 0}
      />
      {trend.offIdeal > 0 ? (
        <p className="text-muted-foreground col-span-3 text-xs">
          {trend.offIdeal} of {trend.lastWeek} in the past week fell outside the
          ideal 2–3 band.
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  warn = false,
}: Readonly<{ label: string; value: string; warn?: boolean }>) {
  return (
    <Card className="gap-0 p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "truncate text-base font-semibold",
          warn ? "text-destructive" : undefined
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
