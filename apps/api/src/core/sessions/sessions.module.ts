import { Module } from '@nestjs/common';

import { AppConfigService } from '../../infrastructure/config/app-config.service';
import { AuditModule } from '../audit/audit.module';

import { SessionService } from './application/session.service';
import { RequestContextEnricherPort } from './domain/ports/request-context-enricher.port';
import { SessionCachePort } from './domain/ports/session-cache.port';
import { SessionExpiryRecorderPort } from './domain/ports/session-expiry-recorder.port';
import { SessionRepositoryPort } from './domain/ports/session-repository.port';
import { SESSION_SETTINGS, type SessionSettings } from './domain/session-settings';
import { AuditSessionExpiryRecorder } from './infrastructure/audit-session-expiry-recorder';
import { CacheProviderSessionCacheAdapter } from './infrastructure/cache-provider-session-cache.adapter';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { RequestContextEnricherAdapter } from './infrastructure/request-context-enricher.adapter';
import { MandatoryPasswordChangeGuard } from './presentation/mandatory-password-change.guard';
import { SessionGuard } from './presentation/session.guard';

@Module({
  imports: [AuditModule],
  providers: [
    SessionService,
    SessionGuard,
    MandatoryPasswordChangeGuard,
    {
      provide: SESSION_SETTINGS,
      useFactory: (appConfig: AppConfigService): SessionSettings => appConfig.session,
      inject: [AppConfigService],
    },
    { provide: SessionRepositoryPort, useClass: PrismaSessionRepository },
    { provide: SessionCachePort, useClass: CacheProviderSessionCacheAdapter },
    { provide: SessionExpiryRecorderPort, useClass: AuditSessionExpiryRecorder },
    { provide: RequestContextEnricherPort, useClass: RequestContextEnricherAdapter },
  ],
  exports: [SessionService, SessionGuard, MandatoryPasswordChangeGuard, SESSION_SETTINGS],
})
export class SessionsModule {}
