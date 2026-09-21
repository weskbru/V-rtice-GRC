/**
 * T190 — builds a safe `Content-Disposition` header value for a
 * downloaded attachment (FR-099, ADR-010). `fileName` is untrusted,
 * caller-supplied metadata (`Attachment.fileName`, "recorded as metadata
 * only" — never used to build a filesystem path, see
 * `local-disk-storage-provider.ts`) — it can legitimately contain quotes,
 * control characters, or characters outside Latin-1, so it is never
 * interpolated into the header raw.
 *
 * Always `attachment` (never `inline`) — FR-099 requires the browser to
 * download the payload, never render it. Both an RFC 6266 ASCII
 * `filename=` fallback (quoted-string, with `"`/`\`/control characters
 * stripped so it cannot terminate the parameter early or inject a header
 * value) and an RFC 5987 `filename*=UTF-8''...` extended parameter
 * (percent-encoded, exact for any Unicode name) are included — a client
 * that supports the extended form uses it; every other client falls back
 * to the sanitized ASCII form.
 */

// Deliberately matching control characters as part of the
// header-injection defense (never interpolating raw user input into a
// response header).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS_OR_QUOTE_OR_BACKSLASH = /[\x00-\x1f\x7f"\\]/g;

function sanitizeAsciiFallback(fileName: string): string {
  // Strip anything outside printable ASCII, plus the characters that would
  // otherwise need escaping inside the quoted-string (`"`, `\`) or that
  // could inject a CR/LF into the response headers.
  const stripped = fileName
    .replace(CONTROL_CHARACTERS_OR_QUOTE_OR_BACKSLASH, '')
    .replace(/[^\x20-\x7e]/g, '_');
  return stripped.length > 0 ? stripped : 'attachment';
}

export function buildContentDispositionHeader(fileName: string): string {
  const asciiFallback = sanitizeAsciiFallback(fileName);
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
