/**
 * T042/T043/T057/005-audit-findings, User Story 2 —
 * `AuditEngagementFindingController`: `contracts/audit.openapi.yaml`'s
 * `/audits/{auditId}/findings` path (`listAuditEngagementFindings`,
 * `createFindingFromEngagement` — operations 12-13). Mirrors
 * `AuditEngagementScopeController`'s own structure.
 *
 * ## `POST` is `@NoPermissionRequired()`, not `@RequirePermission`
 *
 * This route needs TWO permissions with two DIFFERENT refusal shapes
 * (`audit-engagement:view` folds into the engagement's own `404`;
 * `finding:create` is a plain `403`) — the same reason
 * `AuditController.listRiskAuditEvents`
 * (`modules/risk/presentation/audit.controller.ts`) and
 * `ControlLifecycleController`'s transition route are both
 * `@NoPermissionRequired()` rather than `@RequirePermission`. See
 * `CreateFindingFromEngagementUseCase`'s own header for the full
 * reasoning; this decorator still requires a valid session
 * (`@NoPermissionRequired()` never bypasses `SessionGuard`).
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import {
  NoPermissionRequired,
  RequirePermission,
} from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { CreateFindingFromEngagementUseCase } from '../application/create-finding-from-engagement.usecase';
import { ListAuditEngagementFindingsUseCase } from '../application/list-audit-engagement-findings.usecase';

import { CreateFindingFromEngagementRequestDto } from './dto/create-finding-from-engagement-request.dto';
import {
  toFindingSummaryResponse,
  type FindingSummaryResponse,
} from './dto/finding-summary-response.mapper';
import { ListAuditEngagementFindingsQueryDto } from './dto/list-audit-engagement-findings-query.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface AuditEngagementFindingsPageResponse {
  readonly data: readonly FindingSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('audits/:auditId/findings')
export class AuditEngagementFindingController {
  constructor(
    private readonly createFindingFromEngagementUseCase: CreateFindingFromEngagementUseCase,
    private readonly listAuditEngagementFindingsUseCase: ListAuditEngagementFindingsUseCase,
  ) {}

  /** `listAuditEngagementFindings`. Single permission
   * (`audit-engagement:view`) — see that use case's own header for why
   * `finding:view` is deliberately not re-required. */
  @RequirePermission('audit-engagement:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Query() query: ListAuditEngagementFindingsQueryDto,
  ): Promise<AuditEngagementFindingsPageResponse> {
    const result = await this.listAuditEngagementFindingsUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: result.items.map(toFindingSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  /** `createFindingFromEngagement`. See this file's own header for why
   * this route is `@NoPermissionRequired()` rather than
   * `@RequirePermission`. */
  @NoPermissionRequired()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Body() body: CreateFindingFromEngagementRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FindingSummaryResponse> {
    const record = await this.createFindingFromEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      title: body.title,
      description: body.description,
      recommendation: body.recommendation,
      category: body.category,
      origin: body.origin,
      severity: body.severity,
      priority: body.priority,
      ownerUserId: body.ownerUserId,
      identifiedOn: body.identifiedOn,
    });

    // `Location` points at the finding's own canonical resource
    // (`GET /findings/{id}`, `grc-foundation.openapi.yaml`), NOT at this
    // route (which only lists, it has no single-item read). The API's
    // version prefix is derived from this request's own `originalUrl`
    // (`/api/v1/audits/{auditId}/findings`) rather than importing
    // `infrastructure/http/api-prefix` — `module-presentation` may not
    // depend on `infrastructure` (`apps/api/eslint.config.mjs`'s boundary
    // rule), the same constraint `audit-engagement.controller.ts`'s own
    // `create` handler already works within by building its `Location`
    // from `request.originalUrl` too.
    const apiPrefix = request.originalUrl.split('/audits/')[0];
    response.set('Location', `${apiPrefix}/findings/${record.id}`);

    return toFindingSummaryResponse(record);
  }
}
