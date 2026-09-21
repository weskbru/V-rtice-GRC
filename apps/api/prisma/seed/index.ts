/**
 * PharosGRC database seed entry point (T042).
 *
 * Bootstraps a minimal, standalone Nest application context — NOT the full
 * `AppModule` (no HTTP listener, no `HealthModule`/`ThrottlerModule`/
 * guards are relevant to a one-shot script) — solely to obtain
 * `AppConfigService` (validated configuration, never raw `process.env`
 * read from this file — "no `process.env` outside the config layer") and
 * the real `PrismaService` (so the seed runs against the same connection
 * contract — `DATABASE_URL`, the restricted `pharos_app` role — as the
 * running application, per ADR-005). `seedPlatform` (`platform.seed.ts`)
 * does the actual work.
 *
 * Run via `pnpm --filter @pharos/api run db:seed` (`prisma db seed`,
 * configured in `prisma.config.ts` to invoke this file with `tsx`).
 *
 * Plain `console` output (not `AppLogger`) throughout: this script has no
 * HTTP request, so there is no structured-logging request context for
 * `AppLogger` to enrich — the same reasoning the prior no-op placeholder
 * documented.
 *
 * T085 added `seedRiskReferenceData` (`risk-reference.seed.ts`), run after
 * `seedPlatform` — it has no dependency on platform data (categories/types/
 * origins reference nothing platform seeds), but running it second keeps
 * this file's log output in the same order as `docs/local-environment.md`'s
 * "Fundação da plataforma" -> "Gestão de Riscos" module ordering.
 */
import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { AppConfigModule } from '../../src/infrastructure/config/config.module';
import { PrismaModule } from '../../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

import { seedDefaultMethodology } from './methodology.seed';
import { seedPlatform } from './platform.seed';
import { seedRiskReferenceData } from './risk-reference.seed';

@Module({ imports: [AppConfigModule, PrismaModule] })
class SeedApplicationModule {}

async function main(): Promise<void> {
  const appContext = await NestFactory.createApplicationContext(SeedApplicationModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = appContext.get(PrismaService);
    const appConfig = appContext.get(AppConfigService);

    console.log('[prisma:seed] Seeding platform permissions, roles, root organizational unit...');

    const result = await seedPlatform(prisma, appConfig);

    console.log('[prisma:seed] Done.', {
      permissions: result.permissionCount,
      roles: result.roleCount,
      rootOrgUnitId: result.rootOrgUnitId,
      adminUserId: result.adminUserId,
      devFixturesSeeded: result.devFixturesSeeded,
    });

    console.log('[prisma:seed] Seeding risk reference data (categories, types, origins)...');

    const riskReferenceResult = await seedRiskReferenceData(prisma);

    console.log('[prisma:seed] Done.', {
      categories: riskReferenceResult.categoryCount,
      types: riskReferenceResult.typeCount,
      origins: riskReferenceResult.originCount,
    });

    console.log('[prisma:seed] Seeding default risk methodology (5x5)...');

    const methodologyResult = await seedDefaultMethodology(prisma, result.adminUserId);

    console.log('[prisma:seed] Done.', {
      methodologyId: methodologyResult.methodologyId,
      versionId: methodologyResult.versionId,
      versionNumber: methodologyResult.versionNumber,
      created: methodologyResult.created,
    });
  } finally {
    await appContext.close();
  }
}

main().catch((error: unknown) => {
  console.error('[prisma:seed] Seed failed:', error);
  process.exitCode = 1;
});
