import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Printer } from "lucide-react";
import { ScoreChart } from "@/components/score-chart";
import { Button } from "@/components/ui/button";
import { useSnapshotNow } from "@/lib/clock";
import { COLOR_INFO, FLAG_LABELS, scoreInfo } from "@/lib/purina";
import { findDog, logsForDog, useStore } from "@/lib/storage";
import { chartSeries, withinDays } from "@/lib/trend";
import type { PoopLog } from "@/lib/types";

export const Route = createFileRoute("/report/$dogId")({
  component: ReportPage,
});

const WINDOW_DAYS = 30;

/**
 * The one screen a vet holds, and therefore the one screen with no jokes in
 * it at all. Purina's own wording throughout, no nicknames, no achievements,
 * no register switching - lab coat mode changes nothing here because there is
 * nothing here to make more serious.
 *
 * Laid out for paper: see the @media print block in styles.css.
 */
function ReportPage() {
  const { dogId } = Route.useParams();
  const store = useStore();
  const dog = findDog(store, dogId);

  // Held still, so the timestamp on a printed page is not whenever React last
  // happened to re-render it, and every window below is measured from the same
  // moment: a report is a snapshot, and its chart, its table and its printed
  // timestamp all have to agree about when it was taken rather than each
  // picking up its own Date.now(). Stepped on a write and only on a write,
  // because this screen re-renders on one - see useSnapshotNow.
  const asOf = useSnapshotNow();
  const preparedAt = new Date(asOf);

  const logs = useMemo(() => (dog === undefined ? [] : logsForDog(store, dog.id)), [store, dog]);
  const series = useMemo(() => chartSeries(logs, asOf), [logs, asOf]);
  // Oldest first: a clinical record reads forwards. toReversed() would need
  // Safari 16.4 and the build floor here is 16.0; withinDays already returned
  // a fresh array, so reversing it in place mutates nothing shared.
  const window30 = useMemo(
    // oxlint-disable-next-line unicorn/no-array-reverse
    () => withinDays(logs, WINDOW_DAYS, asOf).reverse(),
    [logs, asOf],
  );

  if (dog === undefined) {
    throw notFound();
  }

  const mean =
    window30.length === 0
      ? null
      : window30.reduce((sum, log) => sum + log.score, 0) / window30.length;
  const ideal = window30.filter((log) => scoreInfo(log.score).ideal).length;
  const flagged = window30.filter((log) => log.flags.length > 0).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-12">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link to="/dog/$dogId" params={{ dogId: dog.id }}>
              <ChevronLeft />
              Back to {dog.name}
            </Link>
          }
        />
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>

      <header className="border-border mb-5 border-b pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Purina fecal scoring summary</h1>
        <p className="mt-1 text-sm">
          <span className="font-medium">{dog.name}</span> · {WINDOW_DAYS}-day window
        </p>
        <p className="text-muted-foreground text-xs">
          Prepared {preparedAt.toLocaleString()} · {logs.length}{" "}
          {logs.length === 1 ? "entry" : "entries"} on file in total
        </p>
      </header>

      <section aria-labelledby="report-summary" className="print-break-avoid mb-5">
        <h2 id="report-summary" className="mb-2 text-sm font-semibold">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <Figure label="Entries" value={String(window30.length)} />
          <Figure label="Mean score" value={mean === null ? "—" : mean.toFixed(2)} />
          <Figure
            label="Within 2–3"
            value={window30.length === 0 ? "—" : `${ideal} of ${window30.length}`}
          />
          <Figure label="With findings" value={String(flagged)} />
        </dl>
      </section>

      <section aria-labelledby="report-chart" className="print-break-avoid mb-5">
        <h2 id="report-chart" className="mb-2 text-sm font-semibold">
          Score over time
        </h2>
        <ScoreChart
          series={series}
          label={`${dog.name}: Purina fecal score over the last ${WINDOW_DAYS} days. Every entry is listed in the table below.`}
        />
      </section>

      <section aria-labelledby="report-entries">
        <h2 id="report-entries" className="mb-2 text-sm font-semibold">
          Entries
        </h2>
        {window30.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No entries recorded in the last {WINDOW_DAYS} days.
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <Th>Date</Th>
                <Th>Score</Th>
                <Th>Consistency</Th>
                <Th>Color</Th>
                <Th>Findings</Th>
              </tr>
            </thead>
            <tbody>
              {window30.map((log) => (
                <Row key={log.id} log={log} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="border-border text-muted-foreground mt-6 border-t pt-3 text-xs">
        <p>
          Scores follow the Purina Fecal Scoring Chart (1–7); 2–3 is the reference range. Recorded
          by the owner, stored locally on their device, and not verified by a clinician.
        </p>
      </footer>
    </main>
  );
}

function Figure({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-display font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Th({ children }: Readonly<{ children: React.ReactNode }>) {
  return <th className="text-muted-foreground py-1 pr-3 text-xs font-medium">{children}</th>;
}

function Row({ log }: Readonly<{ log: PoopLog }>) {
  const info = scoreInfo(log.score);
  return (
    <tr className="border-border print-break-avoid border-b last:border-0">
      <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
        {new Date(log.loggedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </td>
      <td className="py-1.5 pr-3 font-medium tabular-nums">{log.score}</td>
      <td className="py-1.5 pr-3">{info.label}</td>
      <td className="py-1.5 pr-3">{log.color === null ? "—" : COLOR_INFO[log.color].label}</td>
      <td className="py-1.5">
        {log.flags.length === 0 ? "—" : log.flags.map((flag) => FLAG_LABELS[flag]).join(", ")}
      </td>
    </tr>
  );
}
