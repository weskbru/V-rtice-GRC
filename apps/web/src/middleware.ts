import { NextResponse } from 'next/server';

import { errors } from '@/lib/messages/errors';

import type { NextRequest } from 'next/server';

/**
 * F-65 (`docs/deferred-findings.md`) — the ONLY middleware this app has.
 *
 * ## The gap this closes
 *
 * `next.config.ts`'s own header comment documents the mechanism in full:
 * every request proxied through the app's one external rewrite (ADR-014,
 * `/api/:path*`) is streamed through Next's internal "clonable body"
 * (`getCloneableBody`, `next/dist/server/body-streams.js`), capped by
 * `experimental.middlewareClientMaxBodySize` (raised to 32 MB there,
 * `MAX_PROXIED_BODY_BYTES` below — the SAME number, not a second one).
 * That cap applies unconditionally, even with no `middleware.ts` at all —
 * this file does not change how a request UNDER the cap behaves. What it
 * adds is the missing fast path ABOVE it: without this file, a body over
 * 32 MB has its clone silently stop early while the original
 * `Content-Length` is still forwarded intact, so the API is left waiting
 * for bytes that will never arrive — `proxy-request.js` only gives up at
 * its own 30s `proxyTimeout`, answering with a bare-text 500 that never
 * reaches the API's own `application/problem+json` handling. Attachments
 * (`core/files`, `ATTACHMENT_MAX_SIZE_BYTES`) are the only upload this
 * proxy ever carries (CLAUDE.md §19.6) — this middleware therefore matches
 * ONLY that one route, not every proxied request.
 *
 * Middleware runs before Next resolves a rewrite, so a request this
 * function refuses never reaches the clone/proxy machinery above at all —
 * no bytes buffered in the web server's memory, no 30s wait, a real,
 * immediate `application/problem+json` 413 instead of a bare-text 500.
 *
 * ## Why `Content-Length`, and why this is a fast path, not the boundary
 *
 * `Content-Length` is a client-supplied header — a real browser upload
 * (`FormData`/`File`) always sets it correctly, but it can be absent
 * (chunked transfer) or forged. This check is deliberately NOT the
 * security boundary: a request that lies about its size, or omits the
 * header, simply falls through to the existing proxy path unchanged, and
 * the API's own `multer` `limits.fileSize` (`ATTACHMENT_MAX_SIZE_BYTES`,
 * `files.module.ts`) remains the sole authority on the real limit — exactly
 * as it already is for every request under 32 MB today (CLAUDE.md
 * §19.7/§19.8: the API is the one calculator, never duplicated). This file
 * only prevents the SLOW, memory-holding failure mode for the common,
 * honest case.
 */
const ATTACHMENT_UPLOAD_PATH = '/api/v1/attachments';
// Matches `next.config.ts`'s `middlewareClientMaxBodySize` exactly — the
// proxy clone's own ceiling, not a second, independently-chosen limit.
const MAX_PROXIED_BODY_BYTES = 32 * 1024 * 1024;

export function middleware(request: NextRequest): NextResponse | undefined {
  if (request.method !== 'POST' || request.nextUrl.pathname !== ATTACHMENT_UPLOAD_PATH) {
    return undefined;
  }

  const contentLength = request.headers.get('content-length');
  const size = contentLength === null ? undefined : Number(contentLength);

  if (size === undefined || !Number.isFinite(size) || size <= MAX_PROXIED_BODY_BYTES) {
    return undefined;
  }

  return NextResponse.json(
    {
      type: 'https://pharosgrc.dev/problems/http-413',
      title: errors.payloadTooLargeTitle,
      status: 413,
      detail: errors.fileTooLarge,
      instance: request.nextUrl.pathname,
      // This response never reaches `RequestContextMiddleware`
      // (`apps/api`) — it is answered entirely by the web origin, before
      // the request ever leaves this process. There is no server-side
      // correlation id to carry, by construction (F-41's own fix for the
      // API-side equivalent of this gap does not apply here — this is a
      // different process, with no `RequestContextStore` of its own).
      correlationId: 'web-proxy-precheck',
    },
    { status: 413, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

// Next.js statically parses `matcher` at build time (it never evaluates
// this file to get the value) — a literal is required here, not
// `ATTACHMENT_UPLOAD_PATH`, even though the two must name the same route.
// Kept as a literal deliberately, with this comment as the guard against
// the two drifting apart, rather than a build-time constant neither
// static-analysis step can follow.
export const config = {
  matcher: '/api/v1/attachments',
};
