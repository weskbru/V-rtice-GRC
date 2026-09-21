import { Global, Module } from '@nestjs/common';

import { AppLogger } from './app-logger.service';
import { NestLoggerAdapter } from './nest-logger.adapter';
import { RequestContextMiddleware } from './request-context';

/**
 * `Global` so `AppLogger` — the only supported logging entry point — is
 * injectable anywhere without every capability re-importing this module.
 * `RequestContextMiddleware` is exported too, so `AppModule.configure()`
 * can register it as global middleware (T019).
 */
@Global()
@Module({
  providers: [AppLogger, NestLoggerAdapter, RequestContextMiddleware],
  exports: [AppLogger, NestLoggerAdapter, RequestContextMiddleware],
})
export class LoggingModule {}
