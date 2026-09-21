/**
 * Unit tests for `ProblemDetailsFilter` (F-41, `docs/deferred-findings.md`).
 * Pure unit tests, no I/O, no NestJS testing module — fakes for `AppLogger`
 * and `ArgumentsHost`, exactly reproducing the ONE exception shape this
 * finding measured: Express's own `json()` body-parser rejects invalid
 * JSON, `@nestjs/core`'s `mapExternalException` converts it to `new
 * BadRequestException(err.message)` — a bare string, never one of this
 * codebase's own `{ title, detail }` object literals — before
 * `RequestContextMiddleware` ever runs, so `RequestContextStore` has
 * nothing published for this request.
 */
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ProblemDetailsFilter } from '../../src/infrastructure/http/problem-details.filter';
import {
  CORRELATION_ID_HEADER,
  RequestContextStore,
} from '../../src/infrastructure/logging/request-context';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';

import type { ProblemDetails } from '../../src/infrastructure/http/problem-details';
import type { AppLogger } from '../../src/infrastructure/logging/app-logger.service';
import type { ArgumentsHost } from '@nestjs/common';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fakeLogger(): AppLogger {
  return {
    security: vi.fn(),
    auditOps: vi.fn(),
    error: vi.fn(),
    operational: vi.fn(),
  } as unknown as AppLogger;
}

interface CapturedResponse {
  readonly body: ProblemDetails;
  readonly status: number;
  readonly headers: Record<string, string>;
}

function fakeHost(): { host: ArgumentsHost; capture: () => CapturedResponse } {
  const headers: Record<string, string> = {};
  let status = 0;
  let body: ProblemDetails | undefined;

  const response = {
    set: (name: string, value: string) => {
      headers[name] = value;
      return response;
    },
    status: (code: number) => {
      status = code;
      return response;
    },
    contentType: () => response,
    json: (payload: ProblemDetails) => {
      body = payload;
      return response;
    },
  };

  const request = { originalUrl: '/api/v1/auth/login' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    capture: () => {
      if (!body) {
        throw new Error('response.json(...) was never called');
      }
      return { body, status, headers };
    },
  };
}

describe('ProblemDetailsFilter — F-41 (malformed JSON body)', () => {
  it('never leaks the raw English body-parser message, translates title/detail to pt-BR, and assigns a real correlation id when none was published', () => {
    const filter = new ProblemDetailsFilter(fakeLogger());
    const { host, capture } = fakeHost();

    // Exactly what `@nestjs/core`'s own `mapExternalException` throws for a
    // body-parser `SyntaxError`/`URIError` — a bare string, never this
    // codebase's own `{ title, detail }` shape.
    const rawParserMessage = 'Unexpected token \'b\', "{"bad json" is not valid JSON';
    const exception = new BadRequestException(rawParserMessage);

    // Deliberately NOT wrapped in `RequestContextStore.run(...)` — this
    // reproduces the exact condition F-41 measured: the middleware that
    // publishes the store never ran for this exception class.
    expect(RequestContextStore.get()).toBeUndefined();
    filter.catch(exception, host);

    const { body, status, headers } = capture();

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    // Never the raw parser text.
    expect(body.detail).not.toContain(rawParserMessage);
    expect(body.detail).not.toContain('JSON at position');
    expect(body.detail).toBe(USER_MESSAGES.server.malformedRequestBody);
    expect(body.title).toBe(USER_MESSAGES.problemTitle.badRequest);
    // The RFC 9457 `type` URI stays an English technical identifier
    // (§11.1) — untouched by this fix.
    expect(body.type).toBe('https://pharosgrc.dev/problems/http-400');

    // Real, attributable id — never the old literal fallback.
    expect(body.correlationId).not.toBe('unknown');
    expect(body.correlationId).toMatch(UUID_PATTERN);
    expect(headers[CORRELATION_ID_HEADER]).toBe(body.correlationId);
  });

  it('reuses the request context correlation id, unchanged, when one was already published', async () => {
    const filter = new ProblemDetailsFilter(fakeLogger());
    const { host, capture } = fakeHost();
    const exception = new BadRequestException('irrelevant for this assertion');

    await RequestContextStore.run(
      {
        correlationId: 'already-published-id',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
        method: 'POST',
        path: '/api/v1/auth/login',
      },
      () => {
        filter.catch(exception, host);
        return Promise.resolve();
      },
    );

    const { body, headers } = capture();
    expect(body.correlationId).toBe('already-published-id');
    expect(headers[CORRELATION_ID_HEADER]).toBe('already-published-id');
  });
});
