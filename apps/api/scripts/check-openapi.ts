import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { API_GLOBAL_PREFIX } from '../src/infrastructure/http/api-prefix';
import { buildOpenApiDocument } from '../src/infrastructure/openapi/document';

const COMMITTED_PATH = path.resolve(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  await app.init();
  const freshDocument = buildOpenApiDocument(app);
  await app.close();

  const fresh = `${JSON.stringify(freshDocument, null, 2)}\n`;

  if (!existsSync(COMMITTED_PATH)) {
    console.error(
      `[openapi:check] ${COMMITTED_PATH} does not exist. ` +
        'Run "pnpm --filter @pharos/api run openapi:generate" and commit it.',
    );
    process.exitCode = 1;
    return;
  }

  const committed = readFileSync(COMMITTED_PATH, 'utf8');

  if (committed !== fresh) {
    console.error(
      '[openapi:check] apps/api/openapi.json is stale relative to the current decorators. ' +
        'Run "pnpm --filter @pharos/api run openapi:generate" and commit the result.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('[openapi:check] apps/api/openapi.json is up to date.');
}

main().catch((error: unknown) => {
  console.error('[openapi:check] Failed:', error);
  process.exitCode = 1;
});
