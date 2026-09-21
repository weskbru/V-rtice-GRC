/**
 * `SessionsModule` — the sessions capability's composition root (T062-T064,
 * ADR-011). Sits directly under `src/core/sessions/`, outside the
 * `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify, so it is the one place allowed to wire a
 * domain port to its infrastructure implementation and to read
 * `AppConfigService` on behalf of `SESSION_SETTINGS` (application/
 * presentation code never reads `AppConfigService` directly, per ADR-011).
 *
 * `SessionGuard` is exported (alongside `SessionService`) so `AppModule`
 * can register it as a global `APP_GUARD` via `useExisting` — see that
 * file's header for the full authentication/authorization guard ordering
 * rationale. `MandatoryPasswordChangeGuard` (S-01) is exported the same
 * way, registered immediately after `SessionGuard`.
 */
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
