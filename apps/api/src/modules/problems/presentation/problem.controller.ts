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

function assertUpdateBodyNotEmpty(body: UpdateProblemRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.problems.updateRequestEmpty,
    });
  }
}
