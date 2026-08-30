import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Download, Plus, Sparkles, X } from "lucide-react";
import { AppTitle } from "@/components/app-title";
import { ModeToggle } from "@/components/mode-toggle";
import { ScoreBadge } from "@/components/score-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildCsv, csvFilename, downloadCsv } from "@/lib/csv";
import { useLexicon, markExported } from "@/lib/meta";
import { scoreInfo } from "@/lib/purina";
import { addDog, logsByDog, useStore } from "@/lib/storage";
import { standings, timeAgo, type Standing } from "@/lib/trend";

export const Route = createFileRoute("/")({
  component: DogListPage,
});

function DogListPage() {
  const store = useStore();
  const copy = useLexicon();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [placeholder, setPlaceholder] = useState(copy.namePlaceholders[0]);

  // store is referentially stable between writes, so all of these recompute
  // only when the data actually changes.
  const dogs = useMemo(() => [...store.dogs].sort((a, b) => a.name.localeCompare(b.name)), [store]);
  const byDog = useMemo(() => logsByDog(store), [store]);
  const table = useMemo(() => standings(dogs, byDog), [dogs, byDog]);

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
          const latest = byDog.get(dog.id)?.[0];
          return (
            <li key={dog.id}>
              <Link to="/dog/$dogId" params={{ dogId: dog.id }} className="block rounded-xl">
                <Card className="hover:bg-muted/50 flex flex-row items-center gap-3 p-4 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{dog.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {latest === undefined
                        ? copy.awaitingFirst
                        : `${timeAgo(latest.loggedAt)} · ${scoreInfo(latest.score).nickname}`}
                    </p>
                  </div>
                  {latest === undefined ? null : <ScoreBadge score={latest.score} />}
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
