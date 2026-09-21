import { expect, test, type APIResponse, type Page } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

/**
 * F3/S-02 (`docs/deferred-findings.md`-class fix; see
 * `specs`-external audit `CONSOLIDATED.md` S-02 and `A2-report.md`
 * A2-F01) — proves the ADR-014 rewrite proxy (`next.config.ts`) no longer
 * mishandles a large request body.
 *
 * ## The bug this guards against
 *
 * `apps/web/next.config.ts` proxies `/api/*` to the NestJS API via an
 * EXTERNAL Next.js rewrite. Next's dev/production server streams every
 * externally-rewritten request body through a size-capped clone
 * (`getCloneableBody`, `next/dist/server/body-streams.js`) gated by
 * `experimental.middlewareClientMaxBodySize` — 10 MB by default
 * (`next/dist/server/config-shared.js`) — and this cap applies
 * unconditionally to every proxied request, even though this app has no
 * `middleware.ts` at all. Past the cap, the clone silently stops early
 * while the original `Content-Length` header is still forwarded intact
 * (`lib/router-server.js` → `proxyRequest`), so the upstream request never
 * completes; `proxy-request.js` only gives up at its own 30s
 * `proxyTimeout`, then answers with a bare-text 500 ("Internal Server
 * Error") that never reaches the API's own `application/problem+json`
 * error handling. Measured before the fix: a 15 MB PDF (well under the
 * API's `ATTACHMENT_MAX_SIZE_BYTES`, 25 MB) succeeded directly against the
 * API (`:3001`) in ~0.09s but hung ~30s and returned a bare 500 through
 * the web origin's rewrite (`:3000`) — the only path any real user or the
 * production deployment (also single-origin per ADR-014) ever uses.
 *
 * The fix raises `middlewareClientMaxBodySize` well above
 * `ATTACHMENT_MAX_SIZE_BYTES` so the full body always reaches the API
 * untouched — the API remains the sole authority on the real limit
 * (CLAUDE.md §19.7/§19.8), this only stops Next from truncating a
 * legitimate request before the API ever sees it.
 *
 * ## What each scenario proves
 *
 * 1. A file above the OLD 10 MB proxy truncation point but at/under the
 *    real API limit succeeds quickly through the web origin — the
 *    truncation bug is gone, not just "less frequent".
 * 2. A file above the real API limit is refused quickly (fast, coherent
 *    `application/problem+json` 413) through the web origin too — the API
 *    stays the authority, and oversized uploads no longer manufacture a
 *    30s hang plus a generic 500 (a resource-exhaustion surface, not only
 *    a UX defect).
 *
 * Both uploads go through `page.request` (Playwright's Node-side API
 * request context tied to the SAME authenticated browser context/cookie
 * jar as `page`) against a RELATIVE URL, so they resolve through
 * Playwright's configured `baseURL` (`APP_ORIGIN`) — this is genuinely
 * the web origin's rewrite, the same one `incidentsApi.uploadAttachment`
 * calls from the rendered "Anexos" tab
 * (`incident-attachments-section.tsx`), not a shortcut around it. Driving
 * the real file input for tens of megabytes would add CDP transfer
 * overhead unrelated to the proxy behaviour under test — the rendered
 * "Anexos" tab flow itself is already covered by
 * `incident-problem-collaboration.spec.ts`.
 */
test.describe('Attachment upload through the web origin does not truncate/hang on size (S-02)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the attachment upload proxy.',
  );

  const FIXTURE_TITLE = '[FIX-F3] Upload de anexo por tamanho (S-02)';

  // Generous bounds: well below the OLD ~30s proxy-timeout hang, and well
  // above the sub-second latency measured on localhost — real headroom for
  // CI variance without weakening what this test actually proves (fast vs.
  // ~30s is not a close call).
  const FAST_UPLOAD_BUDGET_MS = 15_000;

  /** Attachment ids this test created, withdrawn in `afterEach` even on
   * failure (FIXBRIEF rule 8) — `Attachment` has no hard delete
   * (CLAUDE.md's audited-history principle), so "withdraw" is the
   * strongest cleanup the platform allows. */
  let createdAttachmentIds: string[] = [];
  let fixtureIncidentId: string | null = null;

  test.beforeEach(() => {
    createdAttachmentIds = [];
    fixtureIncidentId = null;
  });

  test.afterEach(async ({ page }) => {
    for (const id of createdAttachmentIds) {
      try {
        await page.request.delete(`/api/v1/attachments/${id}`, {
          headers: { Origin: new URL(page.url()).origin },
        });
      } catch {
        // Best-effort cleanup — a failed withdraw here must never mask the
        // test's own assertion failure.
      }
    }
  });

  async function findOrCreateFixtureIncident(page: Page): Promise<string> {
    const listResponse = await page.request.get(
      `/api/v1/incidents?page=1&pageSize=20&search=${encodeURIComponent(FIXTURE_TITLE)}`,
    );
    expect(listResponse.ok(), await describeFailure(listResponse)).toBe(true);
    const listBody = (await listResponse.json()) as {
      data: readonly { id: string; title: string }[];
    };
    const existing = listBody.data.find((incident) => incident.title === FIXTURE_TITLE);
    if (existing) {
      return existing.id;
    }

    await page.goto('/incidents/new');
    await expect(page.getByRole('heading', { name: 'Novo incidente' })).toBeVisible();
    await page.getByLabel('Título').fill(FIXTURE_TITLE);
    await page
      .getByLabel('Descrição')
      .fill(
        'Incidente fixture do F3/S-02, reutilizado entre execuções deste teste (busca por título).',
      );
    await page.getByRole('combobox', { name: 'Severidade' }).click();
    await page.getByRole('option', { name: 'Baixa' }).click();
    await selectSeededRootOrgUnit(page);
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await page.waitForURL(/\/incidents\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
    const url = page.url();
    const match = /\/incidents\/([0-9a-fA-F-]+)$/.exec(url);
    const id = match?.[1];
    if (!id) {
      throw new Error(`could not extract incident id from URL after creation: ${url}`);
    }
    return id;
  }

  test('upload above 10MB and at the API limit succeeds fast; above the API limit is refused fast, both through the web origin', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await signInAsWorkerAdmin(page, testInfo);

    fixtureIncidentId = await findOrCreateFixtureIncident(page);
    const origin = new URL(page.url()).origin;

    // --- Scenario 1: 15 MB — above the OLD 10 MB proxy-truncation point,
    // comfortably below `ATTACHMENT_MAX_SIZE_BYTES` (25 MB) ----------------
    const validSize = 15 * 1024 * 1024;
    const validBuffer = Buffer.alloc(validSize, 0x41);
    Buffer.from('%PDF-1.4\n', 'ascii').copy(validBuffer, 0);

    const validStart = Date.now();
    const validResponse = await page.request.post('/api/v1/attachments', {
      headers: { Origin: origin },
      multipart: {
        entityType: 'INCIDENT',
        entityId: fixtureIncidentId,
        file: {
          name: `[FIX-F3]-valid-15mb-${testInfo.workerIndex}.pdf`,
          mimeType: 'application/pdf',
          buffer: validBuffer,
        },
      },
      timeout: 60_000,
    });
    const validElapsedMs = Date.now() - validStart;

    expect(validResponse.status(), await describeFailure(validResponse)).toBe(201);
    expect(
      validElapsedMs,
      `valid 15 MB upload through the web origin took ${String(validElapsedMs)}ms — the S-02 ` +
        'proxy truncation bug hangs for ~30s before returning a bare 500',
    ).toBeLessThan(FAST_UPLOAD_BUDGET_MS);
    const validBody = (await validResponse.json()) as { id: string };
    createdAttachmentIds.push(validBody.id);

    // --- Scenario 2: 27 MB — above `ATTACHMENT_MAX_SIZE_BYTES` (25 MB) —
    // must be refused by the API's own multer `limits.fileSize`, fast, as
    // a real `application/problem+json` 413, not a 30s hang + bare 500 ----
    const oversizeSize = 27 * 1024 * 1024;
    const oversizeBuffer = Buffer.alloc(oversizeSize, 0x41);
    Buffer.from('%PDF-1.4\n', 'ascii').copy(oversizeBuffer, 0);

    const oversizeStart = Date.now();
    const oversizeResponse = await page.request.post('/api/v1/attachments', {
      headers: { Origin: origin },
      multipart: {
        entityType: 'INCIDENT',
        entityId: fixtureIncidentId,
        file: {
          name: `[FIX-F3]-oversize-27mb-${testInfo.workerIndex}.pdf`,
          mimeType: 'application/pdf',
          buffer: oversizeBuffer,
        },
      },
      timeout: 60_000,
    });
    const oversizeElapsedMs = Date.now() - oversizeStart;

    expect(oversizeResponse.status()).toBe(413);
    expect(
      oversizeElapsedMs,
      `oversized 27 MB upload through the web origin took ${String(oversizeElapsedMs)}ms — the ` +
        'S-02 proxy truncation bug hangs for ~30s regardless of the eventual status code',
    ).toBeLessThan(FAST_UPLOAD_BUDGET_MS);
    expect(oversizeResponse.headers()['content-type']).toContain('application/problem+json');
    const oversizeBody = (await oversizeResponse.json()) as {
      title?: string;
      detail?: string;
      status?: number;
    };
    // Mirrors `apps/api/src/shared/messages/attachment.ts`'s `fileTooLarge`
    // — the API's own coherent, pt-BR refusal reason, not a generic/blank
    // proxy error body.
    expect(oversizeBody.detail).toBe('O arquivo enviado excede o tamanho máximo permitido.');
    expect(oversizeBody.status).toBe(413);
    // No attachment id to push into createdAttachmentIds — 413 creates nothing.
  });

  test('upload above the 32 MB proxy-clone ceiling is refused fast by middleware.ts, not the old 30s hang (F-65)', async ({
    page,
  }, testInfo) => {
    // F-65 (`docs/deferred-findings.md`) — before `apps/web/src/middleware.ts`
    // existed, a body above `next.config.ts`'s `middlewareClientMaxBodySize`
    // (32 MB) hit the exact bug this file's own header describes: the
    // clone silently stops early, the API waits ~30s for bytes that never
    // arrive, and the caller gets a bare-text 500. This scenario proves the
    // fix: middleware reads `Content-Length` and refuses BEFORE Next's own
    // proxy/clone machinery ever runs, so the response is fast and a real
    // `application/problem+json` 413 — never the 30s hang this whole file
    // exists to guard against, now for the size range the earlier two
    // scenarios do not reach.
    test.setTimeout(90_000);
    await signInAsWorkerAdmin(page, testInfo);

    fixtureIncidentId = await findOrCreateFixtureIncident(page);
    const origin = new URL(page.url()).origin;

    const wellOverCeilingSize = 40 * 1024 * 1024;
    const wellOverCeilingBuffer = Buffer.alloc(wellOverCeilingSize, 0x41);
    Buffer.from('%PDF-1.4\n', 'ascii').copy(wellOverCeilingBuffer, 0);

    const start = Date.now();
    const response = await page.request.post('/api/v1/attachments', {
      headers: { Origin: origin },
      multipart: {
        entityType: 'INCIDENT',
        entityId: fixtureIncidentId,
        file: {
          name: `[FIX-F65]-over-ceiling-40mb-${testInfo.workerIndex}.pdf`,
          mimeType: 'application/pdf',
          buffer: wellOverCeilingBuffer,
        },
      },
      timeout: 60_000,
    });
    const elapsedMs = Date.now() - start;

    expect(response.status()).toBe(413);
    expect(
      elapsedMs,
      `40 MB upload above the proxy-clone ceiling took ${String(elapsedMs)}ms — F-65's old ` +
        'behaviour hangs ~30s before returning a bare 500',
    ).toBeLessThan(FAST_UPLOAD_BUDGET_MS);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    const body = (await response.json()) as { title?: string; detail?: string; status?: number };
    // Same wording the API itself would give for the same reason, just
    // caught one layer earlier — see middleware.ts's own header comment.
    expect(body.title).toBe('Arquivo muito grande');
    expect(body.detail).toBe('O arquivo enviado excede o tamanho máximo permitido.');
    expect(body.status).toBe(413);
    // No attachment id — 413 creates nothing, request never reached the API.
  });
});

async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
