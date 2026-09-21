/**
 * Selects and provides the active `CacheProvider` adapter (T017 / D-2).
 *
 * `@nestjs/config`/`AppConfigService` is available (both are `Global`
 * modules) by the time this module's factory runs, so the choice is made
 * once, at startup, from `AppConfigService.cache.redisUrl` — never
 * re-evaluated per request. The active adapter is logged, as required by
 * D-2 and by working rule "logs which adapter is active".
 */
import { Global, Logger, Module } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';

import { CACHE_PROVIDER, type CacheProvider } from './cache-provider';
import { InMemoryCacheProvider } from './in-memory-cache.provider';
import { RedisCacheProvider } from './redis-cache.provider';

const logger = new Logger('CacheModule');

@Global()
@Module({
  providers: [
    {
      provide: CACHE_PROVIDER,
      useFactory: (appConfig: AppConfigService): CacheProvider => {
        const { redisUrl } = appConfig.cache;

        if (redisUrl) {
          logger.log('Cache adapter: Redis (REDIS_URL is set).');
          return new RedisCacheProvider(redisUrl);
        }

        logger.log(
          'Cache adapter: in-memory (REDIS_URL is empty — D-2 fallback). ' +
            'Not safe for a multi-instance deployment; production rejects this configuration.',
        );
        return new InMemoryCacheProvider();
      },
      inject: [AppConfigService],
    },
  ],
  exports: [CACHE_PROVIDER],
})
export class CacheModule {}
