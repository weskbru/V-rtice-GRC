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
import {
  LinkFindingControlUseCase,
  ListFindingControlLinksUseCase,
  UnlinkFindingControlUseCase,
} from '../application/links/link-finding-control.usecase';
import {
  LinkFindingRiskUseCase,
  ListFindingRiskLinksUseCase,
  UnlinkFindingRiskUseCase,
} from '../application/links/link-finding-risk.usecase';

import { CreateFindingControlLinkRequestDto } from './dto/create-finding-control-link-request.dto';
import { CreateFindingRiskLinkRequestDto } from './dto/create-finding-risk-link-request.dto';
import {
  toFindingControlLinkResponse,
  toFindingRiskLinkResponse,
  type FindingControlLinkResponse,
  type FindingRiskLinkResponse,
} from './dto/finding-relationship-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

@Controller('findings/:findingId')
export class FindingRelationshipController {
  constructor(
    private readonly listFindingControlLinksUseCase: ListFindingControlLinksUseCase,
    private readonly linkFindingControlUseCase: LinkFindingControlUseCase,
    private readonly unlinkFindingControlUseCase: UnlinkFindingControlUseCase,
    private readonly listFindingRiskLinksUseCase: ListFindingRiskLinksUseCase,
    private readonly linkFindingRiskUseCase: LinkFindingRiskUseCase,
    private readonly unlinkFindingRiskUseCase: UnlinkFindingRiskUseCase,
  ) {}

  @RequirePermission('finding:view')
  @Get('controls')
  async listControlLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly FindingControlLinkResponse[]> {
    const links = await this.listFindingControlLinksUseCase.execute({
      actorUserId: session.userId,
      findingId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toFindingControlLinkResponse);
  }

  @RequirePermission('finding:link')
  @Post('controls')
  @HttpCode(HttpStatus.CREATED)
  async linkControl(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Body() body: CreateFindingControlLinkRequestDto,
  ): Promise<FindingControlLinkResponse> {
    const link = await this.linkFindingControlUseCase.execute({
      actorUserId: session.userId,
      findingId,
      controlId: body.controlId,
    });
    return toFindingControlLinkResponse(link);
  }

  @RequirePermission('finding:link')
  @Delete('controls/:linkId')
  @HttpCode(HttpStatus.OK)
  async unlinkControl(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<FindingControlLinkResponse> {
    const unlinked = await this.unlinkFindingControlUseCase.execute({
      actorUserId: session.userId,
      findingId,
      linkId,
    });
    return toFindingControlLinkResponse(unlinked);
  }

  @RequirePermission('finding:view')
  @Get('risks')
  async listRiskLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly FindingRiskLinkResponse[]> {
    const links = await this.listFindingRiskLinksUseCase.execute({
      actorUserId: session.userId,
      findingId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toFindingRiskLinkResponse);
  }

  @RequirePermission('finding:link')
  @Post('risks')
  @HttpCode(HttpStatus.CREATED)
  async linkRisk(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Body() body: CreateFindingRiskLinkRequestDto,
  ): Promise<FindingRiskLinkResponse> {
    const link = await this.linkFindingRiskUseCase.execute({
      actorUserId: session.userId,
      findingId,
      riskId: body.riskId,
    });
    return toFindingRiskLinkResponse(link);
  }

  @RequirePermission('finding:link')
  @Delete('risks/:linkId')
  @HttpCode(HttpStatus.OK)
  async unlinkRisk(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<FindingRiskLinkResponse> {
    const unlinked = await this.unlinkFindingRiskUseCase.execute({
      actorUserId: session.userId,
      findingId,
      linkId,
    });
    return toFindingRiskLinkResponse(unlinked);
  }
}
