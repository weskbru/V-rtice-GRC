/**
 * T067 — `AuthController`. Matches `auth.openapi.yaml` exactly (see this
 * task's report for the one documented gap: CSRF's 403 branch is not
 * listed on `POST /auth/login` in the contract, but ADR-002 requires the
 * Origin/Referer check on every state-changing request without exception —
 * `CsrfMiddleware`, T065, applies it there too).
 *
 * Read-only endpoints (`GET /auth/session`, `GET /auth/me`) call
 * `UserDirectoryPort`/`PermissionResolverService`/`ScopeResolverService`
 * directly — no transaction, no audit event, so no need to go through
 * `AuthUseCasesPort`. Every WRITE (`login`, `logout`,
 * `POST /auth/me/password`) goes through `AuthUseCasesPort`, which alone
 * may open the atomic write+audit transaction (see that port's header).
 *
 * S-01 (audit A6-F01): `logout`/`getCurrentSession`/`getOwnProfile`/
 * `changeOwnPassword` carry `@AllowedDuringMandatoryPasswordChange()` — the
 * exact, minimal set of routes a user whose password change is pending
 * needs to reach the password-change screen and act on it. Every other
 * authenticated route in the platform is refused by
 * `MandatoryPasswordChangeGuard` while that flag is set.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';

import { AllowedDuringMandatoryPasswordChange } from '../../../shared/access/allowed-during-mandatory-password-change.decorator';
import { Public } from '../../../shared/access/public.decorator';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { PermissionResolverService } from '../../authorization/application/permission-resolver.service';
import { NoPermissionRequired } from '../../authorization/presentation/permission.guard';
import { ScopeResolverService } from '../../organizations/application/scope-resolver.service';
import {
  buildSessionCookieClearDescriptor,
  buildSessionCookieDescriptor,
} from '../../sessions/domain/session-cookie';
import { SESSION_SETTINGS, type SessionSettings } from '../../sessions/domain/session-settings';
import { AuthUseCasesPort } from '../domain/ports/auth-use-cases.port';
import { UserDirectoryPort, type UserProfile } from '../domain/ports/user-directory.port';

import { CurrentSession } from './current-session.decorator';
import { ChangePasswordRequestDto } from './dto/change-password.dto';
import { LoginRequestDto } from './dto/login.dto';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request, Response } from 'express';

interface EffectiveScopeDto {
  readonly global: boolean;
  readonly orgUnitIds: readonly string[];
}

interface OwnProfileDto {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly status: string;
  readonly primaryOrgUnit: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
  } | null;
  readonly roles: readonly { readonly id: string; readonly name: string }[];
  readonly lastLoginAt: string | null;
}

interface SessionMetadataDto {
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastActivityAt: string;
  readonly authenticationMethod: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

function toEffectiveScopeDto(scope: ScopeFilter): EffectiveScopeDto {
  return scope.kind === 'GLOBAL'
    ? { global: true, orgUnitIds: [] }
    : { global: false, orgUnitIds: Array.from(scope.unitIds) };
}

function toOwnProfileDto(profile: UserProfile): OwnProfileDto {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    jobTitle: profile.jobTitle ?? null,
    status: profile.status,
    primaryOrgUnit: profile.primaryOrgUnit ?? null,
    roles: profile.roles,
    lastLoginAt: profile.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authUseCases: AuthUseCasesPort,
    private readonly userDirectory: UserDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
    @Inject(SESSION_SETTINGS) private readonly sessionSettings: SessionSettings,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    user: OwnProfileDto;
    permissions: readonly string[];
    scope: EffectiveScopeDto;
    session: SessionMetadataDto;
    mustChangePassword: boolean;
  }> {
    const outcome = await this.authUseCases.login({
      email: body.email,
      password: body.password,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });

    const cookie = buildSessionCookieDescriptor(this.sessionSettings);
    response.cookie(cookie.name, outcome.rawToken, cookie.options);

    return {
      user: toOwnProfileDto(outcome.profile),
      permissions: outcome.permissions,
      scope: toEffectiveScopeDto(outcome.scope),
      session: {
        createdAt: outcome.session.createdAt.toISOString(),
        expiresAt: outcome.session.expiresAt.toISOString(),
        lastActivityAt: outcome.session.lastActivityAt.toISOString(),
        authenticationMethod: outcome.session.authenticationMethod,
        ipAddress: outcome.session.ipAddress ?? null,
        userAgent: outcome.session.userAgent ?? null,
      },
      mustChangePassword: outcome.mustChangePassword,
    };
  }

  @NoPermissionRequired()
  @AllowedDuringMandatoryPasswordChange()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentSession() session: ValidatedSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const profile = await this.userDirectory.findProfileById(session.userId);
    await this.authUseCases.logout({
      sessionId: session.sessionId,
      actorLabel: profile?.fullName ?? 'Unknown user',
    });

    const cookie = buildSessionCookieClearDescriptor(this.sessionSettings);
    response.clearCookie(cookie.name, cookie.options);
  }

  @NoPermissionRequired()
  @AllowedDuringMandatoryPasswordChange()
  @Get('session')
  async getCurrentSession(@CurrentSession() session: ValidatedSession): Promise<{
    user: OwnProfileDto;
    permissions: readonly string[];
    scope: EffectiveScopeDto;
    session: SessionMetadataDto;
  }> {
    const profile = await this.requireProfile(session.userId);
    const [permissions, scope] = await Promise.all([
      this.permissionResolver.getEffectivePermissions(session.userId),
      this.scopeResolver.resolveScope(session.userId),
    ]);

    return {
      user: toOwnProfileDto(profile),
      permissions: Array.from(permissions),
      scope: toEffectiveScopeDto(scope),
      session: {
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
        authenticationMethod: session.authenticationMethod,
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
      },
    };
  }

  @NoPermissionRequired()
  @AllowedDuringMandatoryPasswordChange()
  @Get('me')
  async getOwnProfile(@CurrentSession() session: ValidatedSession): Promise<OwnProfileDto> {
    const profile = await this.requireProfile(session.userId);
    return toOwnProfileDto(profile);
  }

  @NoPermissionRequired()
  @AllowedDuringMandatoryPasswordChange()
  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeOwnPassword(
    @CurrentSession() session: ValidatedSession,
    @Body() body: ChangePasswordRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const profile = await this.requireProfile(session.userId);

    await this.authUseCases.changeOwnPassword({
      userId: session.userId,
      actorLabel: profile.fullName,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    const cookie = buildSessionCookieClearDescriptor(this.sessionSettings);
    response.clearCookie(cookie.name, cookie.options);
  }

  private async requireProfile(userId: string): Promise<UserProfile> {
    const profile = await this.userDirectory.findProfileById(userId);
    if (!profile) {
      throw new UnauthorizedDomainError();
    }
    return profile;
  }
}
