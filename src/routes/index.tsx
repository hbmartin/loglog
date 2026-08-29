import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Download, Plus, X } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildCsv, csvFilename, downloadCsv } from "@/lib/csv";
import { scoreInfo } from "@/lib/purina";
import { addDog, logsForDog, useStore } from "@/lib/storage";
import { timeAgo } from "@/lib/trend";

export const Route = createFileRoute("/")({
  component: DogListPage,
});

function DogListPage() {
  const store = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const dogs = [...store.dogs].sort((a, b) => a.name.localeCompare(b.name));

  const submit = () => {
    if (addDog(name) !== null) {
      setName("");
      setAdding(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-12">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">loglog</h1>
          <p className="text-muted-foreground text-sm">
            Purina fecal scoring, kept on this device.
          </p>
        </div>
        <ModeToggle />
      </header>

      {dogs.length === 0 && !adding ? (
        <Card className="mb-4 p-6 text-center">
          <p className="font-medium">No one is being tracked yet.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a dog (or a hairless ape) to start logging.
          </p>
        </Card>
      ) : null}

      <ul className="mb-4 flex flex-col gap-2">
        {dogs.map((dog) => {
          const logs = logsForDog(store, dog.id);
          const latest = logs[0];
          return (
            <li key={dog.id}>
              <Link
                to="/dog/$dogId"
                params={{ dogId: dog.id }}
                className="block rounded-xl"
              >
                <Card className="hover:bg-muted/50 flex flex-row items-center gap-3 p-4 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{dog.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {latest === undefined
                        ? "No logs yet"
                        : `${timeAgo(latest.loggedAt)} · ${scoreInfo(latest.score).label}`}
                    </p>
                  </div>
                  {latest === undefined ? null : (
                    <Badge
                      variant={scoreInfo(latest.score).ideal ? "secondary" : "destructive"}
                    >
                      {latest.score}
                    </Badge>
                  )}
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
            autoFocus
            value={name}
            placeholder="Name"
            aria-label="New dog name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") setAdding(false);
            }}
          />
          <Button onClick={submit} disabled={name.trim() === ""}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel"
            onClick={() => {
              setAdding(false);
              setName("");
            }}
          >
            <X />
          </Button>
        </Card>
      ) : (
        <Button className="w-full" size="lg" onClick={() => setAdding(true)}>
          <Plus />
          Add new dog
        </Button>
      )}

      {store.logs.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-6 w-full"
          onClick={() => downloadCsv(buildCsv(store), csvFilename())}
        >
          <Download />
          Export all logs as CSV
        </Button>
      ) : null}
    </main>
  );
}
