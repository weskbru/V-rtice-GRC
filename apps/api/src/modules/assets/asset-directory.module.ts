import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AssetDirectoryPort } from '../../shared/grc-ports/asset-directory.port';

import { PrismaAssetDirectoryAdapter } from './infrastructure/asset-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: AssetDirectoryPort, useClass: PrismaAssetDirectoryAdapter }],
  exports: [AssetDirectoryPort],
})
export class AssetDirectoryModule {}
