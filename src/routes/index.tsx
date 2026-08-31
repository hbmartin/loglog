import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Download, Plus, Sparkles, X } from "lucide-react";
import { AppTitle } from "@/components/app-title";
import { ModeToggle } from "@/components/mode-toggle";
import { ScoreBadge } from "@/components/score-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNow } from "@/lib/clock";
import { buildCsv, csvFilename, downloadCsv } from "@/lib/csv";
import { useLexicon, markExported } from "@/lib/meta";
import { scoreInfo } from "@/lib/purina";
import { addDog, logsByDog, newestLog, useStore } from "@/lib/storage";
import { standings, timeAgo, type Standing } from "@/lib/trend";
import type { PoopLog } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: DogListPage,
});

function DogListPage() {
  const store = useStore();
  const copy = useLexicon();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [placeholder, setPlaceholder] = useState(copy.namePlaceholders[0]);

  // store is referentially stable between writes and `now` steps once a
  // minute, so all of these recompute only when there is a reason to.
  const dogs = useMemo(() => [...store.dogs].sort((a, b) => a.name.localeCompare(b.name)), [store]);
  const byDog = useMemo(() => logsByDog(store), [store]);

  // Each dog's newest entry, resolved once per write. The row below needs
  // exactly this, and newestLog scans a dog's whole history to find it, so
  // calling it inside dogs.map() puts an O(total logs) run of locale
  // comparisons in the render body - repeated on every keystroke in the
  // add-dog field, every toggle of it, and every step of the clock.
  const latest = useMemo(() => {
    const newest = new Map<string, PoopLog>();
    for (const [dogId, logs] of byDog) {
      const log = newestLog(logs);
      if (log !== undefined) {
        newest.set(dogId, log);
      }
    }
    return newest;
  }, [byDog]);

  // The standings are a rolling week, so they are measured from `now` rather
  // than from the Date.now() default inside standings: memoised on the data
  // alone, that default freezes at whatever moment the store last changed and
  // the week stops rolling.
  const now = useNow();

  const table = useMemo(() => standings(dogs, byDog, now), [dogs, byDog, now]);

  const open = () => {
    // Picked once per opening rather than per render, so the hint does not
    // shuffle under the user while they are typing over it.
    const options = copy.namePlaceholders;
    setPlaceholder(options[Math.floor(Math.random() * options.length)]);
    setAdding(true);
  };

  const close = () => {
    setAdding(false);
    setName("");
  };

  const submit = () => {
    if (addDog(name) !== null) {
      close();
    }
  };

  const exportAll = () => {
    downloadCsv(buildCsv(store), csvFilename());
    markExported();
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-12">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AppTitle>loglog</AppTitle>
          <p className="text-sm font-medium">{copy.tagline}</p>
          <p className="text-muted-foreground text-sm">{copy.taglineDetail}</p>
        </div>
        <ModeToggle />
      </header>

      {dogs.length === 0 && !adding ? (
        <Card className="mb-4 p-6 text-center">
          <p className="font-medium">{copy.emptyTitle}</p>
          <p className="text-muted-foreground mt-1 text-sm">{copy.emptyBody}</p>
        </Card>
      ) : null}

      <ul className="mb-4 flex flex-col gap-2">
        {dogs.map((dog) => {
          const newest = latest.get(dog.id);
          return (
            <li key={dog.id}>
              <Link to="/dog/$dogId" params={{ dogId: dog.id }} className="block rounded-xl">
                <Card className="hover:bg-muted/50 flex flex-row items-center gap-3 p-4 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{dog.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {newest === undefined
                        ? copy.awaitingFirst
                        : `${timeAgo(newest.loggedAt, now)} · ${scoreInfo(newest.score).nickname}`}
                    </p>
                  </div>
                  {newest === undefined ? null : <ScoreBadge score={newest.score} />}
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <Card className="mb-4 flex flex-row items-center gap-2 p-3">
          <Input
            // The field only exists because the user just tapped "Add new
            // dog", so focus belongs here; nothing is stolen on page load.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={name}
            placeholder={placeholder}
            aria-label="New dog name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") close();
            }}
          />
          <Button onClick={submit} disabled={name.trim() === ""}>
            {copy.saveSubject}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Cancel" onClick={close}>
            <X />
          </Button>
        </Card>
      ) : (
        <Button className="w-full" size="lg" onClick={open}>
          <Plus />
          {copy.addSubject}
        </Button>
      )}

      {table.length > 1 ? <Standings table={table} /> : null}

      {store.logs.length > 0 ? (
        <div className="mt-6 flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="w-full" render={<Link to="/wrapped" />}>
            <Sparkles />
            {copy.wrappedLink}
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={exportAll}>
            <Download />
            {copy.exportAll}
          </Button>
        </div>
      ) : null}
    </main>
  );
}

/**
 * Only shown once at least two dogs have logged something this week, because
 * a one-entry leaderboard is just a dog with extra steps.
 */
function Standings({ table }: Readonly<{ table: readonly Standing[] }>) {
  const copy = useLexicon();

  return (
    <section aria-labelledby="standings-heading" className="mt-6">
      <h2 id="standings-heading" className="font-semibold">
        {copy.standingsHeading}
      </h2>
      <p className="text-muted-foreground mb-3 text-sm">{copy.standingsHelp}</p>

      <ol className="flex flex-col gap-2">
        {table.map((standing, index) => (
          <li key={standing.dog.id}>
            <Card className="flex flex-row items-center gap-3 p-3">
              <span className="text-muted-foreground font-display w-5 shrink-0 text-base font-semibold tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{standing.dog.name}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {standing.logs} {standing.logs === 1 ? "log" : "logs"} this week
                </p>
              </div>
              <span className="font-display text-base font-semibold tabular-nums">
                {standing.average.toFixed(1)}
              </span>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
