/**
 * Boots the Nest application context — no HTTP listener — builds the
 * OpenAPI 3.1 document (ADR-009) and writes it to `apps/api/openapi.json`
 * (T025). Requires a reachable PostgreSQL (`DATABASE_URL`): booting the
 * full application context runs every module's `onModuleInit`, including
 * `PrismaService`'s connection.
 *
 * Run via `ts-node`, not `tsx`: `PrismaService extends PrismaClient`
 * (T016) crashes the process with no error output when instantiated under
 * `tsx`'s esbuild-based transform on this Windows/Node 24 setup — `ts-node`
 * (the TypeScript compiler's own transform, matching what `nest build`
 * produces) does not have this problem. Confirmed by bisection before
 * choosing this runner; see the T014-T025 report for details.
 *
 * Run: `pnpm --filter @pharos/api run openapi:generate`.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { API_GLOBAL_PREFIX } from '../src/infrastructure/http/api-prefix';
import { buildOpenApiDocument } from '../src/infrastructure/openapi/document';

const OUTPUT_PATH = path.resolve(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  // Must match main.ts exactly, or the generated paths (e.g. "/health/live")
  // would not match what the running API actually serves ("/api/v1/health/live").
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  await app.init();

  const document = buildOpenApiDocument(app);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();

  console.log(`[openapi:generate] Wrote ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error('[openapi:generate] Failed:', error);
  process.exitCode = 1;
});
