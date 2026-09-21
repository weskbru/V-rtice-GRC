/**
 * T024/003-controls-management — builds the REAL `AppModule` (every guard,
 * filter, pipe and middleware exactly as `main.ts` wires them, identical to
 * `contract-app.ts`'s own `buildContractTestApp`), with the real
 * `ControlsModule` overridden by `ControlsTestModule` (see that file's own
 * header for why this task cannot edit `controls.module.ts` directly).
 *
 * Once the coordinator wires User Story 1's controllers/use-cases/
 * repository bindings into the real `ControlsModule` (this task's report
 * lists exactly what to add), `buildContractTestApp` itself will exercise
 * these same routes with no override needed — this file exists to let this
 * task's own contract suite verify User Story 1 end-to-end in the
 * meantime, without touching the shared module file.
 */
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
  // Mirrors `main.ts`'s own `app.set('etag', false)` — see `contract-app
  // .ts`'s identical line for why this harness must not diverge from it.
  app.set('etag', false);

  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
    },
  };
}
