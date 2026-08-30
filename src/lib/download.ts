/**
 * Handing a generated file to the user. Split out of csv.ts because the error
 * screen needs the same path for its backup download.
 */

export function downloadFile(blob: Blob, filename: string): void {
  // Anchor downloads are unreliable inside an installed iOS PWA, which is
  // exactly where this app is meant to live, so prefer the share sheet.
  const file = new File([blob], filename, { type: blob.type });
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

/** Local calendar date as YYYY-MM-DD, for datestamping filenames. */
export function localDateStamp(now = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}
