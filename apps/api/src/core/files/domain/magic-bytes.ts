/**
 * T189 — magic-byte sniffing (FR-097). Pure, framework-free domain logic:
 * no I/O, no Prisma, no NestJS import — takes a `Buffer` already in memory
 * and returns which allow-listed content type, if any, the BYTES
 * themselves declare.
 *
 * ## Why sniffing exists at all
 *
 * A declared `Content-Type` header and a file extension are both entirely
 * attacker-controlled and neither tells the server what the bytes actually
 * are — an executable renamed to `report.pdf` with a spoofed
 * `Content-Type: application/pdf` passes both those checks trivially. The
 * only fact that cannot be spoofed independently of the payload itself is
 * the payload's own leading bytes. `UploadService` (T189) requires the
 * DECLARED type and the SNIFFED type to agree before anything is stored —
 * this file is the "what do the bytes actually say" half of that check.
 *
 * ## The four allow-listed types, and how each is recognized
 *
 * - `application/pdf` — the literal `%PDF-` signature (5 bytes), always at
 *   offset 0 for a conforming PDF.
 * - `image/png` — the 8-byte PNG signature.
 * - `image/jpeg` — the 3-byte JFIF/Exif SOI marker (`FF D8 FF`), common to
 *   every JPEG variant.
 * - `text/plain` — has no magic number by definition, so it is
 *   recognized by EXCLUSION plus a positive heuristic: the buffer contains
 *   no NUL byte (a strong binary-content signal absent from virtually
 *   every real text file) AND decodes as valid, non-replacement-character
 *   UTF-8 in full. A file that matches none of the three binary signatures
 *   above and fails this text heuristic is unrecognized — not defaulted
 *   to `text/plain` — so genuine binary garbage declared as `text/plain`
 *   is still refused rather than nodded through as "probably text".
 *
 * Extending this allow-list (a future `ATTACHMENT_ALLOWED_MIME_TYPES`
 * value with no sniffable signature here) is a deliberate, reviewed
 * addition to this file — sniffing an unrecognized type as "whatever the
 * caller declared" would silently defeat the whole point of this check.
 */

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

/** The content types this function can positively recognize. Keep in sync
 * with `.env.example`'s `ATTACHMENT_ALLOWED_MIME_TYPES` default — a type
 * present in that list with no recognizer here can never pass the
 * declared/sniffed agreement check `UploadService` requires. */
export const SNIFFABLE_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

export type SniffableContentType = (typeof SNIFFABLE_CONTENT_TYPES)[number];

function startsWith(content: Buffer, signature: Buffer): boolean {
  return (
    content.length >= signature.length && content.subarray(0, signature.length).equals(signature)
  );
}

/** `text/plain` heuristic — see this file's header. `TextDecoder`'s
 * `fatal: true` mode throws on any byte sequence that is not valid UTF-8,
 * which is exactly the check needed here (Node's default lenient decoding
 * would silently substitute U+FFFD for invalid sequences instead of
 * signaling them). */
function looksLikePlainText(content: Buffer): boolean {
  if (content.includes(0x00)) {
    return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
    return true;
  } catch {
    return false;
  }
}

/** Returns the sniffed content type, or `undefined` when `content` matches
 * none of {@link SNIFFABLE_CONTENT_TYPES}. An empty buffer never matches
 * anything (including the `text/plain` heuristic — see below): a
 * zero-byte upload has no bytes to declare a type at all. */
export function sniffContentType(content: Buffer): SniffableContentType | undefined {
  if (content.length === 0) {
    return undefined;
  }
  if (startsWith(content, PDF_SIGNATURE)) {
    return 'application/pdf';
  }
  if (startsWith(content, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(content, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (looksLikePlainText(content)) {
    return 'text/plain';
  }
  return undefined;
}
