import { Module } from '@nestjs/common';

import { AppConfigService } from '../../infrastructure/config/app-config.service';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SessionsModule } from '../sessions/sessions.module';

import { CreateUserUseCase } from './application/create-user.usecase';
import { GetUserUseCase } from './application/get-user.usecase';
import { IdentityResolverService } from './application/identity-resolver.service';
import { ListDirectoryUsersUseCase } from './application/list-directory-users.usecase';
import { ListUsersUseCase } from './application/list-users.usecase';
import { LoginThrottleService } from './application/login-throttle.service';
import { ResetUserPasswordUseCase } from './application/reset-user-password.usecase';
import { RevokeUserSessionsUseCase } from './application/revoke-user-sessions.usecase';
import { SetUserStatusUseCase } from './application/set-user-status.usecase';
import { UpdateUserUseCase } from './application/update-user.usecase';
import {
  AUTHENTICATION_PROVIDERS,
  type AuthenticationProvider,
} from './domain/authentication-provider';
import {
  ARGON2_SETTINGS,
  AUTH_THROTTLE_SETTINGS,
  PASSWORD_POLICY_SETTINGS,
  type Argon2Settings,
  type AuthThrottleSettings,
  type PasswordPolicySettings,
} from './domain/identity-settings';
import { AuthUseCasesPort } from './domain/ports/auth-use-cases.port';
import { RateLimitCachePort } from './domain/ports/rate-limit-cache.port';
import { UserDirectoryPort } from './domain/ports/user-directory.port';
import { AuthOrchestrator } from './infrastructure/auth-orchestrator';
import { CacheProviderRateLimitCacheAdapter } from './infrastructure/cache-provider-rate-limit-cache.adapter';
import { PrismaTransactionRunner } from './infrastructure/prisma-transaction-runner';
import { PrismaUserDirectoryRepository } from './infrastructure/prisma-user-directory.repository';
import { LocalAuthenticationProvider } from './infrastructure/providers/local/local-authentication.provider';
import { AdminUsersController } from './presentation/admin-users.controller';
import { AuthController } from './presentation/auth.controller';
import { DirectoryUsersController } from './presentation/directory-users.controller';

@Module({
  imports: [AuditModule, AuthorizationModule, OrganizationsModule, SessionsModule],
  controllers: [AuthController, DirectoryUsersController, AdminUsersController],
  providers: [
    LoginThrottleService,
    IdentityResolverService,
    ListDirectoryUsersUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    SetUserStatusUseCase,
    ResetUserPasswordUseCase,
    RevokeUserSessionsUseCase,
    LocalAuthenticationProvider,
    AuthOrchestrator,
    { provide: AuthUseCasesPort, useExisting: AuthOrchestrator },
    { provide: UserDirectoryPort, useClass: PrismaUserDirectoryRepository },
    { provide: RateLimitCachePort, useClass: CacheProviderRateLimitCacheAdapter },
    { provide: TransactionRunnerPort, useClass: PrismaTransactionRunner },
    {
      provide: AUTHENTICATION_PROVIDERS,
      useFactory: (local: LocalAuthenticationProvider): readonly AuthenticationProvider[] => [
        local,
      ],
      inject: [LocalAuthenticationProvider],
    },
    {
      provide: ARGON2_SETTINGS,
      useFactory: (appConfig: AppConfigService): Argon2Settings => appConfig.argon2,
      inject: [AppConfigService],
    },
    {
      provide: AUTH_THROTTLE_SETTINGS,
      useFactory: (appConfig: AppConfigService): AuthThrottleSettings => appConfig.authRateLimit,
      inject: [AppConfigService],
    },
    {
      provide: PASSWORD_POLICY_SETTINGS,
      useFactory: (appConfig: AppConfigService): PasswordPolicySettings => appConfig.passwordPolicy,
      inject: [AppConfigService],
    },
  ],
  exports: [AuthUseCasesPort],
})
export class IdentityModule {}
