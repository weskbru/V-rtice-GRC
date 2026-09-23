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
