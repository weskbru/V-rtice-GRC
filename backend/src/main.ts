import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfigService } from './infrastructure/config/app-config.service';
import { API_GLOBAL_PREFIX } from './infrastructure/http/api-prefix';
import { NestLoggerAdapter } from './infrastructure/logging/nest-logger.adapter';

import type { NestExpressApplication } from '@nestjs/platform-express';

const TRUSTED_PROXY_HOPS = 1;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(NestLoggerAdapter));

  app.set('trust proxy', TRUSTED_PROXY_HOPS);

  app.set('etag', false);

  app.use(helmet());

  app.setGlobalPrefix(API_GLOBAL_PREFIX);

  const appConfig = app.get(AppConfigService);

  await app.listen(appConfig.app.apiPort);
}

void bootstrap();
