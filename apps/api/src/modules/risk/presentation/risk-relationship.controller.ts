/**
 * T143 — `RiskRelationshipController`: `GET`/`POST /risks/{riskId}/controls`,
 * `DELETE /risks/{riskId}/controls/{linkId}`, `POST`/`DELETE
 * /risks/{riskId}/processes[/{linkId}]` and `POST`/`DELETE
 * /risks/{riskId}/assets[/{linkId}]` per `contracts/risks.openapi.yaml`'s
 * "Risk Relationships" operations.
 *
 * Controls are gated by `risk:treat` (FR-078: "controls ... influence
 * residual risk" — the same permission governing treatment). Processes and
 * assets are gated by `risk:edit` — distinct permissions per the contract's
 * own descriptions ("Requires risk:treat and scope" vs "Requires risk:edit
 * and scope"), not a copy-paste of one onto the other.
 */
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

  // ---------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Processes
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Assets
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Incidents / Problems (013-incidents-problems-reverse-links —
  // READ-ONLY reverse of IncidentRiskLink/ProblemRiskLink: `modules/risk`
  // never writes either table — `modules/incidents`/`modules/problems`
  // own those write paths, see `list-risk-incident-problem-links.usecase.ts`)
  // ---------------------------------------------------------------------

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
