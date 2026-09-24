import { Global, Module } from '@nestjs/common';

import { AppLogger } from './app-logger.service';
import { NestLoggerAdapter } from './nest-logger.adapter';
import { RequestContextMiddleware } from './request-context';

@Global()
@Module({
  providers: [AppLogger, NestLoggerAdapter, RequestContextMiddleware],
  exports: [AppLogger, NestLoggerAdapter, RequestContextMiddleware],
})
export class LoggingModule {}
