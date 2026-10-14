import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { FrameworkVersionDirectoryPort } from '../../shared/grc-ports/framework-version-directory.port';
import { RequirementDirectoryPort } from '../../shared/grc-ports/requirement-directory.port';

import { PrismaFrameworkVersionDirectoryAdapter } from './infrastructure/framework-version-directory.adapter';
import { PrismaRequirementDirectoryAdapter } from './infrastructure/requirement-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: FrameworkVersionDirectoryPort,
      useClass: PrismaFrameworkVersionDirectoryAdapter,
    },
    { provide: RequirementDirectoryPort, useClass: PrismaRequirementDirectoryAdapter },
  ],
  exports: [FrameworkVersionDirectoryPort, RequirementDirectoryPort],
})
export class ComplianceDirectoryModule {}
