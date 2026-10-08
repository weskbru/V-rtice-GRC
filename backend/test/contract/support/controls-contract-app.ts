import '../../integration/support/env';

import { Test } from '@nestjs/testing';
import helmet from 'helmet';

import { AppModule } from '../../../src/app.module';
import { API_GLOBAL_PREFIX } from '../../../src/infrastructure/http/api-prefix';
import { ControlsModule } from '../../../src/modules/controls/controls.module';

import { ControlsTestModule } from './controls-test-module';

import type { ContractTestContext } from './contract-app';
import type { NestExpressApplication } from '@nestjs/platform-express';

export async function buildControlsContractTestApp(): Promise<ContractTestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(ControlsModule)
    .useModule(ControlsTestModule)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();

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
