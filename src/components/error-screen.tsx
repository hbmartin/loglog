import { AlertTriangle, Download, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile, localDateStamp } from "@/lib/download";
import { exportRawBackup } from "@/lib/storage";

/**
 * Shown when a route throws during render. localStorage is the only copy of
 * this data, so the first thing offered is a way to get it off the device.
 *
 * The backup is the raw persisted string rather than a CSV export: the likely
 * reason we are on this screen is a store that no longer parses, and CSV
 * export needs a valid parsed store.
 */
export function ErrorScreen({ error }: Readonly<{ error: unknown }>) {
  // Typed `unknown`, not `Error`: a boundary receives whatever was thrown, and
  // `throw null` here would take out the last screen offering the backup.
  const details = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  // exportRawBackup answers null rather than throwing, denied storage
  // included - this screen must never throw, and without a backup it still
  // offers a reload.
  const backup = exportRawBackup();

  const saveBackup = () => {
    if (backup === null) {
      return;
    }
    downloadFile(
      new Blob([backup], { type: "application/json" }),
      `loglog-backup-${localDateStamp()}.json`,
    );
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="text-destructive size-10" aria-hidden="true" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Something broke</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {backup === null
            ? "The app hit an error it couldn't recover from."
            : "The app hit an error it couldn't recover from. Your logs are still on this device — save a backup before doing anything else."}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        {backup === null ? null : (
          <Button size="lg" onClick={saveBackup}>
            <Download />
            Save a backup
          </Button>
        )}
        <Button
          variant={backup === null ? "default" : "outline"}
          size="lg"
          onClick={() => window.location.reload()}
        >
          <RotateCw />
          Reload
        </Button>
      </div>

      {details === "" ? null : (
        <details className="w-full text-left">
          <summary className="text-muted-foreground cursor-pointer text-xs">Error details</summary>
          <pre className="text-muted-foreground mt-2 overflow-x-auto rounded-lg border p-3 text-xs">
            {details}
          </pre>
        </details>
      )}
    </main>
  );
}
