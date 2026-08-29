import { scoreInfo } from "@/lib/purina";
import type { Dog, PoopLog, Store } from "@/lib/types";

const COLUMNS = [
  "dog",
  "logged_at",
  "score",
  "score_label",
  "color",
  "blood",
  "mucus",
  "worms",
] as const;

/**
 * Dog names are free text and this file is opened in the vet's spreadsheet, so
 * neutralise anything a spreadsheet would evaluate as a formula.
 */
function defuse(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeField(value: string): string {
  const safe = defuse(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeField).join(",")).join("\r\n");
}

export function buildCsv(store: Store, dogs: readonly Dog[] = store.dogs): string {
  const names = new Map(dogs.map((dog) => [dog.id, dog.name]));
  const logs: PoopLog[] = store.logs
    .filter((log) => names.has(log.dogId))
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

  const rows: string[][] = [
    [...COLUMNS],
    ...logs.map((log) => [
      names.get(log.dogId) ?? "",
      log.loggedAt,
      String(log.score),
      scoreInfo(log.score).label,
      log.color ?? "",
      log.flags.includes("blood") ? "yes" : "",
      log.flags.includes("mucus") ? "yes" : "",
      log.flags.includes("worms") ? "yes" : "",
    ]),
  ];

  return toCsv(rows);
}

export function csvFilename(prefix = "loglog"): string {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const slug = prefix.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "loglog"}-${today}.csv`;
}

export function downloadCsv(content: string, filename: string): void {
  // Leading BOM so Excel reads it as UTF-8 rather than the local codepage.
  const type = "text/csv;charset=utf-8";
  const blob = new Blob([`﻿${content}`], { type });

  // Anchor downloads are unreliable inside an installed iOS PWA, which is
  // exactly where this app is meant to live, so prefer the share sheet.
  const file = new File([blob], filename, { type });
  if (navigator.canShare?.({ files: [file] }) === true) {
    void navigator.share({ files: [file], title: filename }).catch(() => {
      // Cancelled or unsupported at call time; fall through to the anchor.
      anchorDownload(blob, filename);
    });
    return;
  }

  anchorDownload(blob, filename);
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  // Firefox requires the anchor to be in the document to honour the click.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously cancels the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
