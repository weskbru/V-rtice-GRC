import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { API_GLOBAL_PREFIX } from '../src/infrastructure/http/api-prefix';
import { buildOpenApiDocument } from '../src/infrastructure/openapi/document';

const OUTPUT_PATH = path.resolve(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
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
