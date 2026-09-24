import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, setUnauthorizedHandler } from './api-client';

function problemResponse(status: number): Response {
  return new Response(JSON.stringify({ title: 'Problem', status }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

describe('api-client session-expiry seam (T077)', () => {
  const handler = vi.fn();

  beforeEach(() => {
    handler.mockReset();
    setUnauthorizedHandler(handler);
  });

  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('invokes the unauthorized handler on an un-flagged 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(401)));

    await expect(apiClient.get('/auth/session')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the unauthorized handler when skipUnauthorizedHandler is set (e.g. a failed login)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(401)));

    await expect(
      apiClient.post(
        '/auth/login',
        { email: 'a@b.com', password: 'wrong' },
        { skipUnauthorizedHandler: true },
      ),
    ).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('still throws ApiError for a skipped 401 — only the global handler is suppressed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(401)));

    await expect(
      apiClient.post('/auth/me/password', {}, { skipUnauthorizedHandler: true }),
    ).rejects.toMatchObject({ problem: { status: 401 } });
  });
});

describe('api-client version-conflict problem parsing (ADR-013, T099)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts currentVersion/currentStatus/modifiedAt/modifiedBy from a 409 VersionConflictProblem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Conflito de versão',
            status: 409,
            correlationId: 'corr-1',
            currentVersion: 5,
            currentStatus: 'IDENTIFIED',
            modifiedAt: '2026-01-02T10:00:00.000Z',
            modifiedBy: { id: 'user-2', fullName: 'Carlos Lima' },
          }),
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(apiClient.patch('/risks/risk-1', {})).rejects.toMatchObject({
      problem: {
        status: 409,
        currentVersion: 5,
        currentStatus: 'IDENTIFIED',
        modifiedAt: '2026-01-02T10:00:00.000Z',
        modifiedBy: { id: 'user-2', fullName: 'Carlos Lima' },
      },
    });
  });

  it('never fabricates these fields on an ordinary error without them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(422)));

    try {
      await apiClient.get('/risks/risk-1');
      throw new Error('expected apiClient.get to reject');
    } catch (error) {
      expect(error).toMatchObject({ problem: { status: 422 } });
      const apiError = error as { problem: Record<string, unknown> };
      expect(apiError.problem).not.toHaveProperty('currentVersion');
      expect(apiError.problem).not.toHaveProperty('modifiedBy');
    }
  });
});

describe('api-client ETag/If-Match plumbing (ADR-013, T095–T099)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getWithMeta surfaces the ETag response header alongside the parsed body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'risk-1', version: 3 }), {
          status: 200,
          headers: { 'content-type': 'application/json', etag: '"3"' },
        }),
      ),
    );

    const result = await apiClient.getWithMeta<{ id: string; version: number }>('/risks/risk-1');
    expect(result.data).toEqual({ id: 'risk-1', version: 3 });
    expect(result.etag).toBe('"3"');
  });

  it('patchWithMeta sends the supplied If-Match header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'risk-1', version: 4 }), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: '"4"' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.patchWithMeta(
      '/risks/risk-1',
      { title: 'x' },
      { headers: { 'If-Match': '"3"' } },
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['If-Match']).toBe('"3"');
  });
});

describe('api-client multipart upload (US9, T195)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('postFormWithMeta sends the FormData body verbatim, never JSON-encoded or Content-Type-overridden', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'attachment-1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('entityType', 'RISK');
    formData.set('entityId', 'risk-1');
    formData.set('file', new File(['%PDF-1.4'], 'evidencia.pdf', { type: 'application/pdf' }));

    const result = await apiClient.postFormWithMeta<{ id: string }>('/attachments', formData);

    expect(result.data).toEqual({ id: 'attachment-1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/attachments');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(formData);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('postFormWithMeta surfaces a 422 magic-byte mismatch as ApiError with the server detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'O tipo de arquivo declarado não corresponde ao conteúdo enviado.',
          }),
          { status: 422, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    const formData = new FormData();
    await expect(apiClient.postFormWithMeta('/attachments', formData)).rejects.toMatchObject({
      problem: {
        status: 422,
        detail: 'O tipo de arquivo declarado não corresponde ao conteúdo enviado.',
      },
    });
  });
});
