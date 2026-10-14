import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppConfigService } from '../src/infrastructure/config/app-config.service';
import { AppConfigModule } from '../src/infrastructure/config/config.module';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

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
