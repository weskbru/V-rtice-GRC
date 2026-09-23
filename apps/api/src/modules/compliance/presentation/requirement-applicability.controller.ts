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
  Query,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { DeclareRequirementNotApplicableUseCase } from '../application/applicability/declare-requirement-not-applicable.usecase';
import { ListRequirementApplicabilityDeclarationsUseCase } from '../application/applicability/list-requirement-applicability-declarations.usecase';
import { RevokeRequirementApplicabilityUseCase } from '../application/applicability/revoke-requirement-applicability.usecase';

import { DeclareApplicabilityRequestDto } from './dto/declare-applicability-request.dto';
import { ListApplicabilityDeclarationsQueryDto } from './dto/list-applicability-declarations-query.dto';
import {
  toRequirementApplicabilityDeclarationResponse,
  type RequirementApplicabilityDeclarationResponse,
} from './dto/requirement-applicability-declaration-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface ApplicabilityDeclarationListResponse {
  readonly data: readonly RequirementApplicabilityDeclarationResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('requirements/:requirementId/applicability-declarations')
export class RequirementApplicabilityController {
  constructor(
    private readonly listUseCase: ListRequirementApplicabilityDeclarationsUseCase,
    private readonly declareUseCase: DeclareRequirementNotApplicableUseCase,
    private readonly revokeUseCase: RevokeRequirementApplicabilityUseCase,
  ) {}

  @RequirePermission('compliance:view')
  @Get()
  async list(
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Query() query: ListApplicabilityDeclarationsQueryDto,
  ): Promise<ApplicabilityDeclarationListResponse> {
    const result = await this.listUseCase.execute({
      requirementId,
      page: query.page,
      pageSize: query.pageSize,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    return {
      data: result.items.map(toRequirementApplicabilityDeclarationResponse),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('compliance:administer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async declare(
    @CurrentSession() session: ValidatedSession,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Body() body: DeclareApplicabilityRequestDto,
  ): Promise<RequirementApplicabilityDeclarationResponse> {
    const declaration = await this.declareUseCase.execute({
      actorUserId: session.userId,
      requirementId,
      justification: body.justification,
    });
    return toRequirementApplicabilityDeclarationResponse(declaration);
  }

  @RequirePermission('compliance:administer')
  @Delete(':declarationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentSession() session: ValidatedSession,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Param('declarationId', new ParseUUIDPipe()) declarationId: string,
  ): Promise<void> {
    await this.revokeUseCase.execute({
      actorUserId: session.userId,
      requirementId,
      declarationId,
    });
  }
}
