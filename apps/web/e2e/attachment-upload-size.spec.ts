import { expect, test, type APIResponse, type Page } from '@playwright/test';

import { requireSeedCredentials, signInAsWorkerAdmin } from './support/admin-session';
import { selectSeededRootOrgUnit } from './support/org-units';

test.describe('Attachment upload through the web origin does not truncate/hang on size (S-02)', () => {
  requireSeedCredentials(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in the environment — point this run at a seeded backend to exercise the attachment upload proxy.',
  );

  const FIXTURE_TITLE = '[FIX-F3] Upload de anexo por tamanho (S-02)';

  const FAST_UPLOAD_BUDGET_MS = 15_000;

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
      } catch {}
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
    expect(oversizeBody.detail).toBe('O arquivo enviado excede o tamanho máximo permitido.');
    expect(oversizeBody.status).toBe(413);
  });

  test('upload above the 32 MB proxy-clone ceiling is refused fast by middleware.ts, not the old 30s hang (F-65)', async ({
    page,
  }, testInfo) => {
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
    expect(body.title).toBe('Arquivo muito grande');
    expect(body.detail).toBe('O arquivo enviado excede o tamanho máximo permitido.');
    expect(body.status).toBe(413);
  });
});

async function describeFailure(response: APIResponse): Promise<string> {
  if (response.ok()) return '';
  return `expected 2xx, got ${String(response.status())}: ${await response.text()}`;
}
