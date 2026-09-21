/**
 * T050/T051 — builds the REAL `AppModule` (every guard, filter, pipe and
 * middleware exactly as `main.ts` wires them) against the test database,
 * for `supertest`-driven contract tests. Deliberately the full module tree
 * (unlike `test/integration/support/test-app.ts`, which composes a minimal
 * subset per spec) — a contract test's whole point is verifying the
 * publicly reachable HTTP surface behaves as `contracts/*.yaml` documents,
 * which requires every global guard/middleware to actually be active.
 *
 * Importing `../../integration/support/env` FIRST redirects
 * `DATABASE_URL`/`DATABASE_MIGRATION_URL` at `pharos_grc_test` before
 * `AppConfigModule` ever reads them — identical mechanism to the
 * integration harness, reused rather than duplicated.
 */
import '../../integration/support/env';

import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import { afterEach } from 'vitest';

import { AppModule } from '../../../src/app.module';
import { API_GLOBAL_PREFIX } from '../../../src/infrastructure/http/api-prefix';

import {
  assertNoResponseValidationViolations,
  installResponseValidation,
} from './auto-validate-responses';

import type { NestExpressApplication } from '@nestjs/platform-express';

export interface ContractTestContext {
  readonly app: NestExpressApplication;
  close(): Promise<void>;
}

export async function buildContractTestApp(): Promise<ContractTestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();

  // T031/T032 (007-implementation-remediation, research.md D-9) — FIRST in
  // the middleware chain, so it observes the body every later middleware,
  // guard, interceptor and exception filter ultimately sends, whichever of
  // them ends up calling `res.json`/`res.send`. See
  // `auto-validate-responses.ts`'s own header for the full design: this is
  // what validates every response this suite's existing 48 spec files
  // already produce against its own contract operation's schema, with no
  // edit to any of those files.
  installResponseValidation(app);

  app.use(helmet());
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.set('trust proxy', 1);
  // Mirrors `main.ts`'s own `app.set('etag', false)` — see that line's
  // comment for why. A contract test's whole point is verifying the real,
  // publicly reachable HTTP surface, so this harness must not silently
  // diverge from production on a setting the ETag-header assertions below
  // depend on.
  app.set('etag', false);

  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
    },
  };
}

// Registered at MODULE scope, not inside `buildContractTestApp` — Vitest
// gives every test FILE its own fresh module instance by default
// (`isolate: true`), so this `afterEach` call, made once when a spec file
// imports `buildContractTestApp` from this module, applies to that file's
// entire suite. This is the mechanism, not a convention every spec file
// must remember to opt into: none of the 48 existing contract spec files
// import or call anything from `auto-validate-responses.ts` directly.
afterEach(() => {
  assertNoResponseValidationViolations();
});
