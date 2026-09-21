/**
 * T030/004-compliance-management — `FrameworkController`: the framework
 * catalog operations of `contracts/compliance.openapi.yaml`
 * (`listFrameworks`, `createFramework`, `getFramework`, `updateFramework`
 * — operations 1-4). Mirrors `modules/controls/presentation/control.controller.ts`'s
 * structure exactly — see that file's header for the `formatETag`/
 * `parseIfMatchHeader`/`assertUpdateBodyNotEmpty` reasoning this one does
 * not repeat. Re-declared locally rather than imported (ADR-011/SC-007: no
 * business module imports another).
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
import { CreateFrameworkUseCase } from '../application/frameworks/create-framework.usecase';
import { GetFrameworkUseCase } from '../application/frameworks/get-framework.usecase';
import { ListFrameworksUseCase } from '../application/frameworks/list-frameworks.usecase';
import { UpdateFrameworkUseCase } from '../application/frameworks/update-framework.usecase';

import { CreateFrameworkRequestDto } from './dto/create-framework-request.dto';
import { toFrameworkResponse, type FrameworkResponse } from './dto/framework-response.mapper';
import { ListFrameworksQueryDto } from './dto/list-frameworks-query.dto';
import { UpdateFrameworkRequestDto } from './dto/update-framework-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface FrameworkListResponse {
  readonly data: readonly FrameworkResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('frameworks')
export class FrameworkController {
  constructor(
    private readonly createFrameworkUseCase: CreateFrameworkUseCase,
    private readonly getFrameworkUseCase: GetFrameworkUseCase,
    private readonly updateFrameworkUseCase: UpdateFrameworkUseCase,
    private readonly listFrameworksUseCase: ListFrameworksUseCase,
  ) {}

  /** `listFrameworks` — declared BEFORE `findById`'s `:frameworkId` route
   * for the same reason `ControlController.list` documents: Nest
   * dispatches `/frameworks` and `/frameworks/:frameworkId` unambiguously
   * regardless of declaration order. */
  @RequirePermission('compliance:view')
  @Get()
  async list(@Query() query: ListFrameworksQueryDto): Promise<FrameworkListResponse> {
    const result = await this.listFrameworksUseCase.execute({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      origin: query.origin,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    return {
      data: result.items.map(toFrameworkResponse),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('compliance:administer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateFrameworkRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FrameworkResponse> {
    const record = await this.createFrameworkUseCase.execute({
      actorUserId: session.userId,
      name: body.name,
      description: body.description,
      origin: body.origin,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toFrameworkResponse(record);
  }

  @RequirePermission('compliance:view')
  @Get(':frameworkId')
  async findById(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FrameworkResponse> {
    const record = await this.getFrameworkUseCase.execute(frameworkId);

    response.set('ETag', formatETag(record.version));

    return toFrameworkResponse(record);
  }

  @RequirePermission('compliance:administer')
  @Patch(':frameworkId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateFrameworkRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FrameworkResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateFrameworkUseCase.execute({
      actorUserId: session.userId,
      frameworkId,
      expectedVersion,
      name: body.name,
      description: body.description,
      origin: body.origin,
    });

    response.set('ETag', formatETag(record.version));

    return toFrameworkResponse(record);
  }
}

/** Exported for reuse by `framework-version.controller.ts`/
 * `requirement.controller.ts` — every mutating endpoint in this module
 * formats/parses `ETag`/`If-Match` identically (ADR-013), so this is the
 * one place any of them does it, mirroring `ControlController
 * .formatETag`. */
export function formatETag(version: number): string {
  return `"${String(version)}"`;
}

/** Exported for reuse — see `formatETag`'s doc comment above, and
 * `ControlController.parseIfMatchHeader` for the full `400`/`409` split
 * this mirrors. */
export function parseIfMatchHeader(headerValue: string | undefined): number {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.compliance.ifMatchRequired,
    });
  }

  const unquoted = headerValue.trim().replace(/^"|"$/g, '');
  const version = Number(unquoted);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.compliance.ifMatchInvalid,
    });
  }

  return version;
}

/** `UpdateFrameworkRequest`'s `minProperties: 1` — see
 * `ControlController.assertUpdateBodyNotEmpty`'s own doc comment for why
 * this is a controller-level check with no dedicated validator class. */
function assertUpdateBodyNotEmpty(body: UpdateFrameworkRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.compliance.updateRequestEmpty,
    });
  }
}
