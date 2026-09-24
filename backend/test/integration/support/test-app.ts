import './env';

import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { AuditModule } from '../../../src/core/audit/audit.module';
import { AppConfigModule } from '../../../src/infrastructure/config/config.module';
import { PrismaModule } from '../../../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';
import { AssetDirectoryModule } from '../../../src/modules/assets/asset-directory.module';
import { ControlDirectoryModule } from '../../../src/modules/controls/control-directory.module';
import { ControlEffectivenessModule } from '../../../src/modules/controls/control-effectiveness.module';
import { IncidentAssetLinkReadModule } from '../../../src/modules/incidents/incident-asset-link-read.module';
import { IncidentProcessLinkReadModule } from '../../../src/modules/incidents/incident-process-link-read.module';
import { IncidentRiskLinkReadModule } from '../../../src/modules/incidents/incident-risk-link-read.module';
import { ProblemRiskLinkReadModule } from '../../../src/modules/problems/problem-risk-link-read.module';
import { ProcessDirectoryModule } from '../../../src/modules/processes/process-directory.module';
import { RiskControlLinkReadModule } from '../../../src/modules/risk/risk-control-link-read.module';
import { RiskDirectoryModule } from '../../../src/modules/risk/risk-directory.module';

import type { INestApplication, ModuleMetadata } from '@nestjs/common';

export interface IntegrationTestContext {
  readonly app: INestApplication;
  readonly prisma: PrismaService;
  close(): Promise<void>;
}

export interface BuildIntegrationTestingModuleOptions {
  readonly imports?: ModuleMetadata['imports'];
  readonly configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export async function buildIntegrationTestingModule(
  options: BuildIntegrationTestingModuleOptions = {},
): Promise<IntegrationTestContext> {
  let builder = Test.createTestingModule({
    imports: [
      AppConfigModule,
      PrismaModule,
      AuditModule,
      ControlDirectoryModule,
      ControlEffectivenessModule,
      RiskControlLinkReadModule,
      RiskDirectoryModule,
      AssetDirectoryModule,
      ProcessDirectoryModule,
      IncidentRiskLinkReadModule,
      IncidentAssetLinkReadModule,
      IncidentProcessLinkReadModule,
      ProblemRiskLinkReadModule,
      ...(options.imports ?? []),
    ],
  });

  if (options.configure) {
    builder = options.configure(builder);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  (app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void }).set(
    'etag',
    false,
  );
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    close: async () => {
      await app.close();
    },
  };
}
