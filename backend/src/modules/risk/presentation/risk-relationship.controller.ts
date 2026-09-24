import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { GetRiskUseCase } from '../application/get-risk.usecase';
import { LinkAssetUseCase, UnlinkAssetUseCase } from '../application/links/asset-link.usecase';
import {
  LinkControlUseCase,
  UnlinkControlUseCase,
} from '../application/links/control-link.usecase';
import {
  ListRiskIncidentLinksUseCase,
  ListRiskProblemLinksUseCase,
} from '../application/links/list-risk-incident-problem-links.usecase';
import {
  LinkProcessUseCase,
  UnlinkProcessUseCase,
} from '../application/links/process-link.usecase';
import { RiskControlLinkRepositoryPort } from '../domain/ports/risk-relationship-repository.port';

import { LinkEntityRequestDto } from './dto/link-entity-request.dto';
import {
  toControlLinkResponse,
  toEntityLinkResponse,
  toRiskIncidentLinkResponse,
  toRiskProblemLinkResponse,
  type ControlLinkResponse,
  type EntityLinkResponse,
  type RiskIncidentLinkResponse,
  type RiskProblemLinkResponse,
} from './dto/risk-relationship-response.mapper';
import { formatETag, parseIfMatchHeader } from './risk.controller';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Response } from 'express';

@Controller('risks/:riskId')
export class RiskRelationshipController {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly controlLinkRepository: RiskControlLinkRepositoryPort,
    private readonly linkControlUseCase: LinkControlUseCase,
    private readonly unlinkControlUseCase: UnlinkControlUseCase,
    private readonly linkProcessUseCase: LinkProcessUseCase,
    private readonly unlinkProcessUseCase: UnlinkProcessUseCase,
    private readonly linkAssetUseCase: LinkAssetUseCase,
    private readonly unlinkAssetUseCase: UnlinkAssetUseCase,
    private readonly listRiskIncidentLinksUseCase: ListRiskIncidentLinksUseCase,
    private readonly listRiskProblemLinksUseCase: ListRiskProblemLinksUseCase,
  ) {}

  @RequirePermission('risk:view')
  @Get('controls')
  async listControlLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly ControlLinkResponse[]> {
    await this.getRiskUseCase.execute({ actorUserId: session.userId, riskId });
    const includeWithdrawn = includeWithdrawnRaw === 'true';
    const links = await this.controlLinkRepository.listByRisk(riskId, includeWithdrawn);
    return links.map(toControlLinkResponse);
  }

  @RequirePermission('risk:treat')
  @Post('controls')
  @HttpCode(HttpStatus.CREATED)
  async linkControl(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @Body() body: LinkEntityRequestDto,
  ): Promise<ControlLinkResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    const { link, risk } = await this.linkControlUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      controlId: body.id,
    });
    response.set('ETag', formatETag(risk.version));
    return toControlLinkResponse(link);
  }

  @RequirePermission('risk:treat')
  @Delete('controls/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkControl(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    const risk = await this.unlinkControlUseCase.execute({
      actorUserId: session.userId,
      riskId,
      linkId,
      expectedVersion,
    });
    response.set('ETag', formatETag(risk.version));
  }

  @RequirePermission('risk:edit')
  @Post('processes')
  @HttpCode(HttpStatus.CREATED)
  async linkProcess(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @Body() body: LinkEntityRequestDto,
  ): Promise<EntityLinkResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    const { link, risk } = await this.linkProcessUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      processId: body.id,
    });
    response.set('ETag', formatETag(risk.version));
    return toEntityLinkResponse(link);
  }

  @RequirePermission('risk:edit')
  @Delete('processes/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkProcess(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    const risk = await this.unlinkProcessUseCase.execute({
      actorUserId: session.userId,
      riskId,
      linkId,
      expectedVersion,
    });
    response.set('ETag', formatETag(risk.version));
  }

  @RequirePermission('risk:edit')
  @Post('assets')
  @HttpCode(HttpStatus.CREATED)
  async linkAsset(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @Body() body: LinkEntityRequestDto,
  ): Promise<EntityLinkResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    const { link, risk } = await this.linkAssetUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      assetId: body.id,
    });
    response.set('ETag', formatETag(risk.version));
    return toEntityLinkResponse(link);
  }

  @RequirePermission('risk:edit')
  @Delete('assets/:linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkAsset(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    const risk = await this.unlinkAssetUseCase.execute({
      actorUserId: session.userId,
      riskId,
      linkId,
      expectedVersion,
    });
    response.set('ETag', formatETag(risk.version));
  }

  @RequirePermission('risk:view')
  @Get('incidents')
  async listIncidentLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly RiskIncidentLinkResponse[]> {
    const links = await this.listRiskIncidentLinksUseCase.execute({
      actorUserId: session.userId,
      riskId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toRiskIncidentLinkResponse);
  }

  @RequirePermission('risk:view')
  @Get('problems')
  async listProblemLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly RiskProblemLinkResponse[]> {
    const links = await this.listRiskProblemLinksUseCase.execute({
      actorUserId: session.userId,
      riskId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toRiskProblemLinkResponse);
  }
}
