/**
 * T180 — `AdminOrgUnitsController`: `GET|POST /admin/org-units`,
 * `GET|PATCH /admin/org-units/{orgUnitId}`,
 * `PUT /admin/org-units/{orgUnitId}/status`
 * (`contracts/admin.openapi.yaml`'s `Organizational Units` tag). Every
 * operation requires `org_unit:administer` (T172). Distinct from
 * `OrgUnitController` (`GET /org-units`, scope-filtered, no administrative
 * permission) in this same capability.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { RequirePermission } from '../../authorization/presentation/permission.guard';
import { CurrentSession } from '../../identity/presentation/current-session.decorator';
import { OrgUnitAdminService } from '../application/org-unit-admin.service';

import { AdminOrgUnitsQueryDto } from './dto/admin-org-units-query.dto';
import { CreateOrgUnitRequestDto } from './dto/create-org-unit-request.dto';
import { toOrgUnitNodeResponse, type OrgUnitNodeResponse } from './dto/org-unit-response.mapper';
import { SetOrgUnitStatusRequestDto } from './dto/set-org-unit-status-request.dto';
import { UpdateOrgUnitRequestDto } from './dto/update-org-unit-request.dto';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request, Response } from 'express';

@Controller('admin/org-units')
export class AdminOrgUnitsController {
  constructor(private readonly orgUnitAdmin: OrgUnitAdminService) {}

  @RequirePermission('org_unit:administer')
  @Get()
  async list(@Query() query: AdminOrgUnitsQueryDto): Promise<readonly OrgUnitNodeResponse[]> {
    const units = await this.orgUnitAdmin.list(query.status);
    return units.map(toOrgUnitNodeResponse);
  }

  @RequirePermission('org_unit:administer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateOrgUnitRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OrgUnitNodeResponse> {
    const unit = await this.orgUnitAdmin.create({
      actorUserId: session.userId,
      code: body.code,
      name: body.name,
      parentId: body.parentId ?? undefined,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${unit.id}`);
    return toOrgUnitNodeResponse(unit);
  }

  @RequirePermission('org_unit:administer')
  @Get(':orgUnitId')
  async findById(
    @Param('orgUnitId', new ParseUUIDPipe()) orgUnitId: string,
  ): Promise<OrgUnitNodeResponse> {
    const unit = await this.orgUnitAdmin.getById(orgUnitId);
    return toOrgUnitNodeResponse(unit);
  }

  @RequirePermission('org_unit:administer')
  @Patch(':orgUnitId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('orgUnitId', new ParseUUIDPipe()) orgUnitId: string,
    @Body() body: UpdateOrgUnitRequestDto,
  ): Promise<OrgUnitNodeResponse> {
    assertUpdateBodyNotEmpty(body);

    const unit = await this.orgUnitAdmin.update({
      actorUserId: session.userId,
      orgUnitId,
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      // `body.parentId !== undefined` — not `'parentId' in body` — is the
      // correct "was this field actually sent" test here: see
      // `assertUpdateBodyNotEmpty`'s header below for why `in`/`Object.keys`
      // against a `class-transformer` instance cannot tell "omitted" from
      // "present" on this DTO. `undefined` still means omitted (JSON has no
      // `undefined`, so the only way `body.parentId` reads `undefined` is
      // the key never having been sent); `null` means "reparent to root".
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
    });
    return toOrgUnitNodeResponse(unit);
  }

  @RequirePermission('org_unit:administer')
  @Put(':orgUnitId/status')
  async setStatus(
    @CurrentSession() session: ValidatedSession,
    @Param('orgUnitId', new ParseUUIDPipe()) orgUnitId: string,
    @Body() body: SetOrgUnitStatusRequestDto,
  ): Promise<OrgUnitNodeResponse> {
    const unit = await this.orgUnitAdmin.setStatus({
      actorUserId: session.userId,
      orgUnitId,
      status: body.status,
    });
    return toOrgUnitNodeResponse(unit);
  }
}

/**
 * Named after `RiskController`'s identical-in-intent
 * `assertUpdateBodyNotEmpty`, but NOT copying its `Object.keys(body).length
 * === 0` check: under this project's `target: ES2023` (default
 * `useDefineForClassFields: true`), `class-transformer`'s `plainToInstance`
 * defines every declared class field on the instance — as `undefined` when
 * the client omitted it — so an actually-empty `{}` request body still
 * yields an instance whose `Object.keys(...)` lists every declared
 * property. Checking for at least one DEFINED value is what
 * `minProperties: 1` actually requires here.
 */
function assertUpdateBodyNotEmpty(body: UpdateOrgUnitRequestDto): void {
  const hasAnyField = Object.values(body).some((value) => value !== undefined);
  if (!hasAnyField) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.admin.updateRequestEmpty,
    });
  }
}
