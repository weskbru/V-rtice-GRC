import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuditModule } from './core/audit/audit.module';
import { AuthorizationModule } from './core/authorization/authorization.module';
import { PermissionGuard } from './core/authorization/presentation/permission.guard';
import { CommentsModule } from './core/comments/comments.module';
import { DashboardModule } from './core/dashboard/dashboard.module';
import { FilesModule } from './core/files/files.module';
import { IdentityModule } from './core/identity/identity.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { OrganizationsModule } from './core/organizations/organizations.module';
import { MandatoryPasswordChangeGuard } from './core/sessions/presentation/mandatory-password-change.guard';
import { SessionGuard } from './core/sessions/presentation/session.guard';
import { SessionsModule } from './core/sessions/sessions.module';
import { ActionModule } from './grc/action/action.module';
import { EvidenceModule } from './grc/evidence/evidence.module';
import { FindingModule } from './grc/finding/finding.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { AppConfigService } from './infrastructure/config/app-config.service';
import { AppConfigModule } from './infrastructure/config/config.module';
import { HealthModule } from './infrastructure/health/health.module';
import { CsrfMiddleware } from './infrastructure/http/csrf.middleware';
import { ProblemDetailsFilter } from './infrastructure/http/problem-details.filter';
import { createValidationPipe } from './infrastructure/http/validation';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { RequestContextMiddleware } from './infrastructure/logging/request-context';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AuditEngagementsModule } from './modules/audit-engagements/audit-engagements.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ControlAssessmentModule } from './modules/controls/control-assessment.module';
import { ControlRelationshipModule } from './modules/controls/control-relationship.module';
import { ControlsModule } from './modules/controls/controls.module';
import { DashboardSummaryModule } from './modules/dashboard/dashboard-summary.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RiskModule } from './modules/risk/risk.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    AuditModule,
    CacheModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        throttlers: [
          {
            ttl: appConfig.throttle.ttlSeconds * 1000,
            limit: appConfig.throttle.limit,
          },
        ],
      }),
    }),
    HealthModule,
    AuthorizationModule,
    OrganizationsModule,
    SessionsModule,
    IdentityModule,
    CommentsModule,
    DashboardModule,
    FilesModule,
    NotificationsModule,
    ActionModule,
    RiskModule,
    EvidenceModule,
    FindingModule,
    ControlsModule,
    ControlAssessmentModule,
    ControlRelationshipModule,
    ComplianceModule,
    AuditEngagementsModule,
    AssetsModule,
    ProcessesModule,
    IncidentsModule,
    ProblemsModule,
    IndicatorsModule,
    ReportsModule,
    DashboardSummaryModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useExisting: MandatoryPasswordChangeGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
    CsrfMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
