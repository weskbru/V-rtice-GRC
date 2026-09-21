import { loadWebEnv } from './src/lib/env';

import type { NextConfig } from 'next';

// ADR-014 (single origin): the browser only ever talks to this app's own
// origin. `/api/*` is rewritten server-side to the NestJS API so the
// session's httpOnly cookie stays first-party and no CORS configuration or
// cross-site cookie semantics are ever needed. The rewrite target comes from
// validated configuration (`loadWebEnv`), never a hard-coded string — an
// absent/invalid `API_INTERNAL_URL` fails the build immediately rather than
// silently rewriting to nowhere.
const { API_INTERNAL_URL } = loadWebEnv();

const nextConfig: NextConfig = {
  // F-6: `docker/web.Dockerfile`'s runtime stage copies `.next/standalone`
  // (a pruned, self-contained server bundle — see the Next.js docs page
  // linked in that Dockerfile) and nothing else from the build; without
  // `output: "standalone"` `next build` never produces that directory and the
  // image cannot be assembled.
  //
  // Gated behind DOCKER_BUILD rather than always on: standalone output makes
  // `next build` recreate pnpm's symlinked node_modules tree inside
  // `.next/standalone`, which needs SeCreateSymbolicLinkPrivilege (Windows
  // Developer Mode, or an elevated shell). Neither is available on this
  // native Windows development machine, and turning this on unconditionally
  // was verified to break `pnpm --filter @pharos/web run build` outright —
  // `EPERM: operation not permitted, symlink ...`. `docker/web.Dockerfile`
  // builds inside a Linux container, where unprivileged symlink creation is
  // normal, so it sets DOCKER_BUILD=1 before running the same `build` script.
  // `next dev` (local dev) and Playwright's `webServer` (which runs `pnpm
  // dev`, not `build`) never read this flag and are unaffected either way.
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  eslint: {
    // Linting runs as its own root-level `pnpm lint` step (and in CI) against
    // the flat `eslint.config.mjs` at the repository root, which Next's
    // bundled build-time ESLint runner cannot resolve from inside a pnpm
    // workspace package. Avoids a duplicate, differently-configured lint pass.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
  experimental: {
    // S-02: every request proxied through an *external* rewrite (this
    // app's only rewrite — the ADR-014 target above) is streamed via
    // Next's "clonable body" (`getCloneableBody` /
    // `next/dist/server/body-streams.js`), which `router-server.js` calls
    // unconditionally when handing the request to `proxyRequest` — this
    // app has no `middleware.ts`, but the cap still applies, because the
    // mechanism isn't gated behind actual middleware use. Past
    // `middlewareClientMaxBodySize` (10 MB default,
    // `next/dist/server/config-shared.js`) the clone silently stops
    // early while the original `Content-Length` header is still forwarded
    // unchanged, so the upstream (the API) is left waiting for bytes that
    // never arrive; `proxy-request.js` only gives up at its 30s
    // `proxyTimeout`, answering with a bare-text 500 ("Internal Server
    // Error") that never reaches the API's own JSON error handling —
    // confirmed by reading both files, not just observed behavior.
    //
    // Attachments (`core/files`, `ATTACHMENT_MAX_SIZE_BYTES` in
    // `apps/api/.env`, 25 MB today) are the only upload routed through
    // this rewrite and the platform-wide, single-limit capability
    // (CLAUDE.md §19.6). This value is deliberately NOT read from that
    // same env var: `apps/web/src/lib/env.ts` is intentionally narrow
    // (API_INTERNAL_URL/APP_ORIGIN only — see its own header comment) and
    // duplicating a business limit across two processes' config is worse
    // than a documented, generous constant. Raising this only stops Next
    // from truncating a body before the API ever sees it — it does not
    // relax or duplicate the limit itself: a file over
    // `ATTACHMENT_MAX_SIZE_BYTES` still reaches the API whole and is
    // still rejected there (multer's `limits.fileSize`, `files.module.ts`),
    // now fast instead of after a 30s timeout.
    //
    // Why not much higher: the same clone also pushes every chunk into a
    // second PassThrough that nothing reads while proxying, so up to this
    // many bytes of each proxied body sit in the web server's memory —
    // before the API has authenticated anything. The value bounds that per
    // request. 32 MB clears the 25 MB business limit plus multipart
    // overhead; a file larger than 32 MB still fails the slow way (truncated,
    // 30s, bare 500) — a deliberate trade recorded in
    // `specs/013-stabilization-audit/STATE.md`, not an oversight. If the API
    // limit is raised, raise this with it.
    middlewareClientMaxBodySize: 32 * 1024 * 1024, // 32 MB
  },
};

export default nextConfig;
