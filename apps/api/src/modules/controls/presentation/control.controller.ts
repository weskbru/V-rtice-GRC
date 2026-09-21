/**
 * T023/003-controls-management — `ControlController`: the catalog and
 * record operations of `contracts/controls.openapi.yaml`
 * (`listControlCatalog`, `createControl`, `getControl`, `updateControl` —
 * operations 1-4 of 6). Mirrors `modules/risk/presentation/risk.controller.ts`'s
 * structure exactly — see that file's header for the `formatETag`/
 * `parseIfMatchHeader`/`assertUpdateBodyNotEmpty` reasoning this one does
 * not repeat. Re-declared locally rather than imported from
 * `modules/risk` (ADR-011/SC-007: no business module imports another).
 *
 * ## `GET /controls` — ownership transferred from Risk's `RegistryController`
 *
 * This route previously lived on `modules/risk/presentation/registry.controller.ts`
 * as `listControls` (`risk:view`, the Fase 1 minimal-registry shape). This
 * task's Task A carries out the handover the Fase 1 schema comment itself
 * anticipated ("a future module can take ownership without migrating risk
 * data") — see this task's report for the full account, including why
 * `ControlSummary` is a superset of the old `RegistryItem` shape (same
 * field names for `id`/`code`/`name`/`description`/`isActive`) so
 * `apps/web/src/features/risks/api.ts`'s `listControlRegistry` keeps
 * working unchanged against the SAME query parameters it already sends
 * (`pageSize`, `q`).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateControlUseCase } from '../application/create-control.usecase';
import { GetControlUseCase } from '../application/get-control.usecase';
import { ListControlsUseCase } from '../application/list-controls.usecase';
import { UpdateControlUseCase } from '../application/update-control.usecase';

import {
  toControlDetailResponse,
  type ControlDetailResponse,
  type ControlSummaryResponse,
} from './dto/control-response.mapper';
import { toControlSummaryResponse } from './dto/control-summary-response.mapper';
import { CreateControlRequestDto } from './dto/create-control-request.dto';
import { ListControlsQueryDto } from './dto/list-controls-query.dto';
import { UpdateControlRequestDto } from './dto/update-control-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface ControlCatalogPageResponse {
  readonly data: readonly ControlSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('controls')
export class ControlController {
  constructor(
    private readonly createControlUseCase: CreateControlUseCase,
    private readonly getControlUseCase: GetControlUseCase,
    private readonly updateControlUseCase: UpdateControlUseCase,
    private readonly listControlsUseCase: ListControlsUseCase,
  ) {}

  /**
   * `listControlCatalog` (US1, `contracts/controls.openapi.yaml`). Declared
   * BEFORE `findById`'s `:controlId` route in this file for the same
   * reason `RiskController.list` documents: Nest dispatches `/controls` and
   * `/controls/:controlId` unambiguously regardless of declaration order.
   *
   * Every item carries `effectiveness`, computed fresh on this read
   * (`control-effectiveness.service.ts`'s own header, D-2/§19.7 — no
   * stored column exists for it at all) and never tied to that item's
   * `version`. `Cache-Control: no-store` here for the identical reason
   * `findById` documents in full below: no cache may be given grounds to
   * replay a stale page of this catalog.
   */
  @RequirePermission('control:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListControlsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlCatalogPageResponse> {
    const result = await this.listControlsUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
      effectiveness: query.effectiveness,
      nature: query.nature,
      type: query.type,
      frequency: query.frequency,
      orgUnitId: query.orgUnitId,
      ownerUserId: query.ownerUserId,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    response.set('Cache-Control', 'no-store');

    return {
      data: result.items.map(toControlSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('control:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateControlRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlDetailResponse> {
    const record = await this.createControlUseCase.execute({
      actorUserId: session.userId,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      nature: body.nature,
      type: body.type,
      frequency: body.frequency,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toControlDetailResponse(record);
  }

  /**
   * `getControl`. Deliberately carries NO `ETag` — the fix for the same
   * class of defect confirmed on `RequirementController.findById`
   * (`apps/api/src/modules/compliance/presentation/requirement.controller.ts`,
   * see that method's doc comment for the full account this one does not
   * repeat).
   *
   * `effectiveness` has NO stored column at all
   * (`control-effectiveness.service.ts`'s own header, D-2/§19.7) — it is
   * calculated fresh on every read from attested `ControlAssessment` rows
   * and the current clock, and is NOT reflected in `record.version`, which
   * only advances when the control's OWN columns are edited via `PATCH
   * /controls/{id}` or a lifecycle transition. Attesting an assessment can
   * change `effectiveness` without touching `version`; worse, a control's
   * `effectiveness` can flip to `EXPIRED` from the passage of time ALONE,
   * with no write to the database at all — no version-bump scheme could
   * ever make an `ETag` a valid freshness validator for this field, even in
   * principle.
   *
   * As on `RequirementController.findById`, `Cache-Control: no-store` alone
   * would not be sufficient while an `ETag` remained: Express's built-in
   * `res.send()` decides `if (req.fresh) this.status(304)` purely from the
   * request's conditional headers against whatever `ETag` THIS response
   * carries, never from this response's own `Cache-Control` (see
   * `node_modules/express/lib/response.js` and the `fresh` package it
   * calls). Not calling `response.set('ETag', ...)` here is not enough BY
   * ITSELF, either — Express auto-generates its own weak, content-hash
   * `ETag` for any JSON response left unset, and while that one IS honest
   * (it hashes the whole body, so it moves with `effectiveness`), the
   * frontend's `resolveEtag` below cannot distinguish it from a real
   * version and would echo it into the next `If-Match`, breaking every
   * such `PATCH` with 400 `ifMatchInvalid`. `main.ts` disables Express's
   * auto-`ETag` globally for exactly this reason (`app.set('etag',
   * false)`) — this response carries no `ETag` at all, not merely one
   * this handler chose not to set. `Cache-Control: no-store` is kept
   * anyway so no cache stores this representation to revalidate against in
   * the first place.
   *
   * The frontend already tolerates a GET with no `ETag`:
   * `apps/web/src/features/controls/api.ts`'s `resolveEtag(etag,
   * data.version)` falls back to the body's own `version` for the
   * `If-Match` a subsequent `PATCH /controls/{id}` needs — that PATCH's
   * concurrency token is entirely unaffected.
   */
  @RequirePermission('control:view')
  @Get(':controlId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlDetailResponse> {
    const record = await this.getControlUseCase.execute({
      actorUserId: session.userId,
      controlId,
    });

    response.set('Cache-Control', 'no-store');

    return toControlDetailResponse(record);
  }

  @RequirePermission('control:edit')
  @Patch(':controlId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateControlRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlDetailResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateControlUseCase.execute({
      actorUserId: session.userId,
      controlId,
      expectedVersion,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      nature: body.nature,
      type: body.type,
      frequency: body.frequency,
    });

    response.set('ETag', formatETag(record.version));

    return toControlDetailResponse(record);
  }
}

/** Exported for reuse by `control-lifecycle.controller.ts` — every
 * control-mutating endpoint formats/parses `ETag`/`If-Match` identically
 * (ADR-013), so this is the one place either does it, mirroring
 * `risk.controller.ts`'s own `formatETag`. */
export function formatETag(version: number): string {
  return `"${String(version)}"`;
}

/** Exported for reuse by `control-lifecycle.controller.ts` — see
 * `formatETag`'s doc comment above, and `risk.controller.ts`'s own
 * `parseIfMatchHeader` for the full `400`/`409` split this mirrors. */
export function parseIfMatchHeader(headerValue: string | undefined): number {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.controls.ifMatchRequired,
    });
  }

  const unquoted = headerValue.trim().replace(/^"|"$/g, '');
  const version = Number(unquoted);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.controls.ifMatchInvalid,
    });
  }

  return version;
}

/** `UpdateControlRequest`'s `minProperties: 1` — see
 * `UpdateControlRequestDto`'s header and `RiskController
 * .assertUpdateBodyNotEmpty`'s own doc comment for why this is a
 * controller-level check (the `plainToInstance` own-property caveat) with
 * no dedicated validator class. */
function assertUpdateBodyNotEmpty(body: UpdateControlRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.controls.updateRequestEmpty,
    });
  }
}
