import { downloadFile, localDateStamp } from "@/lib/download";
import { scoreInfo } from "@/lib/purina";
import { compareTime } from "@/lib/trend";
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
  // filter() already returns a fresh array, so sorting it in place mutates
  // nothing shared. toSorted would need Safari 16.4; the floor here is 16.0.
  const logs: PoopLog[] = store.logs
    .filter((log) => names.has(log.dogId))
    .sort((a, b) => compareTime(a.loggedAt, b.loggedAt));

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
  const slug = prefix
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "loglog"}-${localDateStamp()}.csv`;
}

export function downloadCsv(content: string, filename: string): void {
  // Leading BOM so Excel reads it as UTF-8 rather than the local codepage.
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" });
  downloadFile(blob, filename);
}
