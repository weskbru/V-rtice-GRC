import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { RequirePermission } from '../../authorization/presentation/permission.guard';
import { CurrentSession } from '../../identity/presentation/current-session.decorator';
import { ScopeGrantService } from '../application/scope-grant.service';

import { GrantOrgScopeRequestDto } from './dto/grant-org-scope-request.dto';
import {
  toOrgScopeGrantResponse,
  type OrgScopeGrantResponse,
} from './dto/org-scope-grant-response.mapper';

import type { ValidatedSession } from '../../sessions/application/session.service';

@Controller('admin/users/:userId/scope-grants')
export class AdminUserScopeGrantsController {
  constructor(private readonly scopeGrants: ScopeGrantService) {}

  @RequirePermission('user:administer')
  @Get()
  async list(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<readonly OrgScopeGrantResponse[]> {
    const grants = await this.scopeGrants.list(userId);
    return grants.map(toOrgScopeGrantResponse);
  }

  @RequirePermission('user:administer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async grant(
    @CurrentSession() session: ValidatedSession,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: GrantOrgScopeRequestDto,
  ): Promise<OrgScopeGrantResponse> {
    const grant = await this.scopeGrants.grant({
      actorUserId: session.userId,
      userId,
      scopeType: body.scopeType,
      orgUnitId: body.orgUnitId ?? undefined,
    });
    return toOrgScopeGrantResponse(grant);
  }

  @RequirePermission('user:administer')
  @Delete(':grantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentSession() session: ValidatedSession,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('grantId', new ParseUUIDPipe()) grantId: string,
  ): Promise<void> {
    await this.scopeGrants.revoke(userId, grantId, session.userId);
  }
}
