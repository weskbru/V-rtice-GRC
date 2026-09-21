/**
 * T030/T056/004-compliance-management — `RequirementController`: every
 * `Requirement` operation of the contract — `createRequirement` (op 11),
 * `updateRequirement` (op 13), and, since T056 (Fase 5, User Story 3),
 * `listRequirements`/`getRequirement` (ops 10/12). The latter two return
 * `complianceState` tied to the observation-time audit comparison
 * (research.md D-11) — `GetRequirementUseCase`/`ListRequirementsUseCase`
 * (built ahead of this wiring at T027) already embed that side effect via
 * `RequirementComplianceReaderService`, so this controller adds no
 * auditing logic of its own.
 *
 * No shared `@Controller()` prefix — the routes this class owns sit under
 * two entirely different path roots (`/frameworks/.../requirements` and
 * `/requirements/{id}`), so each handler declares its own full path.
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
import { CreateRequirementUseCase } from '../application/requirements/create-requirement.usecase';
import { GetRequirementUseCase } from '../application/requirements/get-requirement.usecase';
import { ListRequirementsUseCase } from '../application/requirements/list-requirements.usecase';
import { UpdateRequirementUseCase } from '../application/requirements/update-requirement.usecase';

import { CreateRequirementRequestDto } from './dto/create-requirement-request.dto';
import { ListRequirementsQueryDto } from './dto/list-requirements-query.dto';
import { toRequirementResponse, type RequirementResponse } from './dto/requirement-response.mapper';
import { UpdateRequirementRequestDto } from './dto/update-requirement-request.dto';
import { formatETag, parseIfMatchHeader } from './framework.controller';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface RequirementListResponse {
  readonly data: readonly RequirementResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller()
export class RequirementController {
  constructor(
    private readonly createRequirementUseCase: CreateRequirementUseCase,
    private readonly updateRequirementUseCase: UpdateRequirementUseCase,
    private readonly getRequirementUseCase: GetRequirementUseCase,
    private readonly listRequirementsUseCase: ListRequirementsUseCase,
  ) {}

  /**
   * `listRequirements` — every item carries `complianceState`, freshly
   * derived on this read (`GetRequirementUseCase`'s own header, D-8) and
   * never tied to that item's `version`. `Cache-Control: no-store` here for
   * the identical reason `findById` documents in full below: no cache may
   * be given grounds to replay a stale page of this list.
   */
  @RequirePermission('compliance:view')
  @Get('frameworks/:frameworkId/versions/:versionId/requirements')
  async list(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Query() query: ListRequirementsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementListResponse> {
    const result = await this.listRequirementsUseCase.execute({
      frameworkId,
      versionId,
      page: query.page,
      pageSize: query.pageSize,
      complianceStates: query.complianceState,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    response.set('Cache-Control', 'no-store');

    return {
      data: result.items.map(toRequirementResponse),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  /**
   * `getRequirement`. Deliberately never sets an explicit, VERSION-based
   * `ETag` — the fix for a confirmed defect found in the browser: linking
   * a control left the requirement showing its previous `complianceState`
   * until a hard reload.
   *
   * `complianceState` is derived fresh on every read
   * (`RequirementComplianceReaderService`, D-8) and is NOT reflected in
   * `record.version` — `version` only advances when the requirement's OWN
   * columns (`externalRef`/`title`/`description`) are edited via `PATCH
   * /requirements/{id}` (ADR-013's optimistic-lock counter). Linking or
   * unlinking a control, declaring or revoking not-applicable, or simply
   * the clock crossing an assessment's validity window can all change
   * `complianceState` without ever touching `version`.
   *
   * A `version`-based `ETag` here would assert freshness for a
   * representation that can change underneath it, and `Cache-Control:
   * no-store` alone is NOT sufficient to neutralize that: Express's own
   * `res.send()` runs an unconditional `if (req.fresh) this.status(304)`
   * (see `node_modules/express/lib/response.js`), and `fresh()` decides
   * purely from the REQUEST's `If-None-Match`/`If-Modified-Since` against
   * whatever `ETag` THIS response happens to carry — it never consults
   * this response's own `Cache-Control`. A version-only `ETag` left in
   * place would let any client that still sends a matching `If-None-Match`
   * (a copy cached before this fix shipped, a proxy that disregards
   * `no-store`, any conditional-GET-capable client) receive a genuine
   * `304` replaying the PREVIOUS body forever — the same bug, reproduced
   * by the server itself instead of by a downstream cache.
   *
   * Not setting our own `ETag` here is not enough BY ITSELF: Express
   * auto-generates its own weak, content-hash `ETag` on any JSON response
   * whose handler left the header unset (`response.js`'s `generateETag`
   * branch). That auto-generated one is actually honest — it hashes the
   * whole serialized body, so it changes whenever `complianceState` does —
   * but this app's frontend (`resolveEtag`, next paragraph) cannot tell an
   * honest hash apart from a stale version number; it treats ANY non-null
   * `ETag` on a `GET` as the resource's `version` and echoes it verbatim
   * in the next `PATCH`'s `If-Match`, which would then fail every time
   * with 400 `ifMatchInvalid`. `main.ts` therefore disables Express's
   * auto-`ETag` globally (`app.set('etag', false)`, see that line's own
   * comment) — this handler can rely on the response truly carrying no
   * `ETag` at all, not merely one this code chose not to set.
   *
   * `Cache-Control: no-store` is set regardless, as defense in depth and
   * because it is the literal contract for any GET whose body can go stale
   * without its version changing: no cache — browser, proxy or otherwise —
   * may store this representation in the first place.
   *
   * The frontend already tolerates a GET with no `ETag` at all:
   * `apps/web/src/features/compliance/api.ts`'s `resolveEtag(etag,
   * data.version)` falls back to the body's own `version` for the
   * `If-Match` a subsequent `PATCH /requirements/{id}` needs — PATCH's own
   * concurrency token is entirely unaffected; only this GET's (previously
   * dishonest) freshness signal changes.
   */
  @RequirePermission('compliance:view')
  @Get('requirements/:requirementId')
  async findById(
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementResponse> {
    const record = await this.getRequirementUseCase.execute(requirementId);

    response.set('Cache-Control', 'no-store');

    return toRequirementResponse(record);
  }

  @RequirePermission('compliance:administer')
  @Post('frameworks/:frameworkId/versions/:versionId/requirements')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateRequirementRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementResponse> {
    const record = await this.createRequirementUseCase.execute({
      actorUserId: session.userId,
      frameworkId,
      versionId,
      externalRef: body.externalRef,
      title: body.title,
      description: body.description,
    });

    // Unlike `FrameworkController`/`FrameworkVersionController` (whose
    // `GET`-by-id route sits directly under the same path the `POST`
    // itself used), a requirement's own `GET` root is `/requirements/{id}`
    // — a different path entirely from the nested creation route. The API
    // root is derived from this SAME request's own `originalUrl` (always
    // `<root>/frameworks/...`) rather than importing the global prefix
    // constant directly — `module-presentation` may not depend on the
    // top-level `infrastructure` element that constant lives in
    // (`apps/api/eslint.config.mjs`'s boundary rules; `core-presentation`
    // is the one layer permitted to do so, which this is not).
    const apiRoot = request.originalUrl.split('/frameworks/')[0];
    response.set('Location', `${apiRoot}/requirements/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toRequirementResponse(record);
  }

  @RequirePermission('compliance:administer')
  @Patch('requirements/:requirementId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateRequirementRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateRequirementUseCase.execute({
      actorUserId: session.userId,
      requirementId,
      expectedVersion,
      externalRef: body.externalRef,
      title: body.title,
      description: body.description,
    });

    response.set('ETag', formatETag(record.version));

    return toRequirementResponse(record);
  }
}

/** `UpdateRequirementRequest`'s `minProperties: 1` — mirrors
 * `FrameworkController.assertUpdateBodyNotEmpty`'s own doc comment. */
function assertUpdateBodyNotEmpty(body: UpdateRequirementRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.compliance.updateRequestEmpty,
    });
  }
}
