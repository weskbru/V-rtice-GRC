import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

/**
 * `PrismaService` and `CACHE_PROVIDER` are provided by `Global` modules
 * (`PrismaModule`, `CacheModule`) imported once in `AppModule`, so no
 * explicit import is needed here to inject them into `HealthController`.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
