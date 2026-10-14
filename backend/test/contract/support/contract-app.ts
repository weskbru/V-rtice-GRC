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

  installResponseValidation(app);

  app.use(helmet());
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.set('trust proxy', 1);
  app.set('etag', false);

  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
    },
  };
}

afterEach(() => {
  assertNoResponseValidationViolations();
});
