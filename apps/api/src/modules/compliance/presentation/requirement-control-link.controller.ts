import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Body,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import {
  LinkRequirementToControlUseCase,
  UnlinkRequirementFromControlUseCase,
} from '../application/links/link-requirement-control.usecase';
import { ListRequirementControlLinksUseCase } from '../application/links/list-requirement-control-links.usecase';

import { LinkRequirementControlRequestDto } from './dto/link-requirement-control-request.dto';
import {
  toRequirementControlLinkResponse,
  type RequirementControlLinkResponse,
} from './dto/requirement-control-link-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

function parseIncludeWithdrawn(raw: string | undefined): boolean {
  return raw === 'true';
}

@Controller('requirements/:requirementId/controls')
export class RequirementControlLinkController {
  constructor(
    private readonly listUseCase: ListRequirementControlLinksUseCase,
    private readonly linkUseCase: LinkRequirementToControlUseCase,
    private readonly unlinkUseCase: UnlinkRequirementFromControlUseCase,
  ) {}

  @RequirePermission('compliance:view')
  @Get()
  async list(
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly RequirementControlLinkResponse[]> {
    const links = await this.listUseCase.execute({
      requirementId,
      includeWithdrawn: parseIncludeWithdrawn(includeWithdrawnRaw),
    });
    return links.map(toRequirementControlLinkResponse);
  }

  @RequirePermission('compliance:map')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async link(
    @CurrentSession() session: ValidatedSession,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Body() body: LinkRequirementControlRequestDto,
  ): Promise<RequirementControlLinkResponse> {
    const link = await this.linkUseCase.execute({
      actorUserId: session.userId,
      requirementId,
      controlId: body.controlId,
    });
    return toRequirementControlLinkResponse(link);
  }

  @RequirePermission('compliance:map')
  @Delete(':linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(
    @CurrentSession() session: ValidatedSession,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<void> {
    await this.unlinkUseCase.execute({
      actorUserId: session.userId,
      requirementId,
      linkId,
    });
  }
}
