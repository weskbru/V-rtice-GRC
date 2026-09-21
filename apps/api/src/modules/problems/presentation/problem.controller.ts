/**
 * 008-incidents-problems, US2 — `ProblemController`:
 * `contracts/problems.openapi.yaml`'s `/problems` and
 * `/problems/{problemId}[/transitions]` paths (`listProblems`,
 * `createProblem`, `getProblem`, `updateProblem`, `transitionProblem`).
 * Every route carries an explicit authorization decision — either
 * `@RequirePermission` or, for `transition` below, `@NoPermissionRequired()`
 * — there is no route on this controller left undecorated, and no
 * `DELETE` route exists (a problem is cancelled or closed, never
 * physically deleted).
 *
 * `POST /transitions` is `@NoPermissionRequired()`, not
 * `@RequirePermission(...)` — mirrors `control-lifecycle.controller.ts`'s
 * identical reasoning: `PermissionGuard` fails CLOSED when a route carries
 * neither decorator (confirmed empirically: every transition request
 * answered 403 before this was added), and a single route serving every
 * `(from, to)` pair cannot carry one static permission — the real check
 * happens one layer down, in `TransitionProblemUseCase`, against
 * `problem-lifecycle.ts`'s own table.
 *
 * Link routes (`/problems/{problemId}/risks`, `/problems/{problemId}
 * /incidents`) belong to a separate controller, owned by the front
 * building US3's relationship work — not this file.
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
  Query,
} from '@nestjs/common';

import {
  NoPermissionRequired,
  RequirePermission,
} from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateProblemUseCase } from '../application/create-problem.usecase';
import { GetProblemUseCase } from '../application/get-problem.usecase';
import { ListProblemsUseCase } from '../application/list-problems.usecase';
import { TransitionProblemUseCase } from '../application/transition-problem.usecase';
import { UpdateProblemUseCase } from '../application/update-problem.usecase';

import { CreateProblemRequestDto } from './dto/create-problem-request.dto';
import { ListProblemsQueryDto } from './dto/list-problems-query.dto';
import {
  toProblemDetailResponse,
  toProblemSummaryResponse,
  type ProblemDetailResponse,
  type ProblemSummaryResponse,
} from './dto/problem-response.mapper';
import { TransitionProblemRequestDto } from './dto/transition-problem-request.dto';
import { UpdateProblemRequestDto } from './dto/update-problem-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface ProblemPageResponse {
  readonly data: readonly ProblemSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('problems')
export class ProblemController {
  constructor(
    private readonly createProblemUseCase: CreateProblemUseCase,
    private readonly listProblemsUseCase: ListProblemsUseCase,
    private readonly getProblemUseCase: GetProblemUseCase,
    private readonly updateProblemUseCase: UpdateProblemUseCase,
    private readonly transitionProblemUseCase: TransitionProblemUseCase,
  ) {}

  @RequirePermission('problem:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListProblemsQueryDto,
  ): Promise<ProblemPageResponse> {
    const result = await this.listProblemsUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      severity: query.severity,
      search: query.search,
      orgUnitId: query.orgUnitId,
      sort: query.sort,
      direction: query.direction,
    });

    return {
      data: result.items.map((item) => toProblemSummaryResponse(item)),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('problem:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateProblemRequestDto,
  ): Promise<ProblemDetailResponse> {
    const record = await this.createProblemUseCase.execute({
      actorUserId: session.userId,
      title: body.title,
      description: body.description,
      severity: body.severity,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      identifiedOn: new Date(body.identifiedOn),
    });

    return toProblemDetailResponse(record);
  }

  @RequirePermission('problem:view')
  @Get(':problemId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
  ): Promise<ProblemDetailResponse> {
    const record = await this.getProblemUseCase.execute({
      actorUserId: session.userId,
      problemId,
    });
    return toProblemDetailResponse(record);
  }

  @RequirePermission('problem:edit')
  @Patch(':problemId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Body() body: UpdateProblemRequestDto,
  ): Promise<ProblemDetailResponse> {
    assertUpdateBodyNotEmpty(body);

    const updated = await this.updateProblemUseCase.execute({
      actorUserId: session.userId,
      problemId,
      title: body.title,
      description: body.description,
      severity: body.severity,
      ownerUserId: body.ownerUserId,
    });

    return toProblemDetailResponse(updated);
  }

  /**
   * The sole writer of `status` (data-model.md §4) — permission is
   * checked INSIDE `TransitionProblemUseCase` against
   * `problem-lifecycle.ts`'s own table, not by a static
   * `@RequirePermission` here, mirroring
   * `control-lifecycle.controller.ts`'s identical reasoning (every legal
   * `(from, to)` pair happens to name the same `problem:transition`
   * permission today, but the table — not this decorator — is the source
   * of truth).
   */
  @NoPermissionRequired()
  @Post(':problemId/transitions')
  @HttpCode(HttpStatus.OK)
  async transition(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Body() body: TransitionProblemRequestDto,
  ): Promise<ProblemDetailResponse> {
    const updated = await this.transitionProblemUseCase.execute({
      actorUserId: session.userId,
      problemId,
      toStatus: body.toStatus,
      rootCause: body.rootCause,
      cancellationReason: body.cancellationReason,
      reopenReason: body.reopenReason,
    });

    return toProblemDetailResponse(updated);
  }
}

/** `UpdateProblemRequest`'s `minProperties: 1` — controller-level check,
 * mirroring `finding.controller.ts#assertUpdateBodyNotEmpty`'s own
 * documented reasoning. */
function assertUpdateBodyNotEmpty(body: UpdateProblemRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.problems.updateRequestEmpty,
    });
  }
}
