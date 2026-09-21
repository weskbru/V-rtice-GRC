/**
 * 008-incidents-problems, US3 — `IncidentRelationshipController`:
 * `GET`/`POST /incidents/{incidentId}/risks`,
 * `DELETE /incidents/{incidentId}/risks/{linkId}`, the same three shapes
 * for `/assets` and `/processes`, and the READ-ONLY
 * `GET /incidents/{incidentId}/problems`
 * (`specs/008-incidents-problems/contracts/incidents.openapi.yaml`'s
 * "Incident Relationships" operations). Mirrors
 * `grc/finding/presentation/finding-relationship.controller.ts` exactly: a
 * separate controller file from the CRUD/lifecycle controller, `200` (not
 * `204`) with the withdrawn link body on unlink — `Incident` has no
 * `version` column to echo via `ETag` the way `Risk` does.
 *
 * All five routes are gated by `incident:link` (contract's own
 * "Requires `incident:link`..." wording on every write route; the four GET
 * list routes reuse `incident:view`, the same convention
 * `FindingRelationshipController` establishes for its own list routes —
 * the contract states no override for them).
 */
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
  LinkIncidentAssetUseCase,
  ListIncidentAssetLinksUseCase,
  UnlinkIncidentAssetUseCase,
} from '../application/links/link-incident-asset.usecase';
import {
  LinkIncidentProcessUseCase,
  ListIncidentProcessLinksUseCase,
  UnlinkIncidentProcessUseCase,
} from '../application/links/link-incident-process.usecase';
import {
  LinkIncidentRiskUseCase,
  ListIncidentRiskLinksUseCase,
  UnlinkIncidentRiskUseCase,
} from '../application/links/link-incident-risk.usecase';
import { ListIncidentProblemLinksUseCase } from '../application/links/list-incident-problem-links.usecase';

import {
  toIncidentAssetLinkResponse,
  toIncidentProblemLinkResponse,
  toIncidentProcessLinkResponse,
  toIncidentRiskLinkResponse,
  type IncidentAssetLinkResponse,
  type IncidentProblemLinkResponse,
  type IncidentProcessLinkResponse,
  type IncidentRiskLinkResponse,
} from './dto/incident-relationship-response.mapper';
import { LinkIncidentAssetRequestDto } from './dto/link-incident-asset-request.dto';
import { LinkIncidentProcessRequestDto } from './dto/link-incident-process-request.dto';
import { LinkIncidentRiskRequestDto } from './dto/link-incident-risk-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

@Controller('incidents/:incidentId')
export class IncidentRelationshipController {
  constructor(
    private readonly listIncidentRiskLinksUseCase: ListIncidentRiskLinksUseCase,
    private readonly linkIncidentRiskUseCase: LinkIncidentRiskUseCase,
    private readonly unlinkIncidentRiskUseCase: UnlinkIncidentRiskUseCase,
    private readonly listIncidentAssetLinksUseCase: ListIncidentAssetLinksUseCase,
    private readonly linkIncidentAssetUseCase: LinkIncidentAssetUseCase,
    private readonly unlinkIncidentAssetUseCase: UnlinkIncidentAssetUseCase,
    private readonly listIncidentProcessLinksUseCase: ListIncidentProcessLinksUseCase,
    private readonly linkIncidentProcessUseCase: LinkIncidentProcessUseCase,
    private readonly unlinkIncidentProcessUseCase: UnlinkIncidentProcessUseCase,
    private readonly listIncidentProblemLinksUseCase: ListIncidentProblemLinksUseCase,
  ) {}

  // ---------------------------------------------------------------------
  // Risks
  // ---------------------------------------------------------------------

  @RequirePermission('incident:view')
  @Get('risks')
  async listRiskLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly IncidentRiskLinkResponse[]> {
    const links = await this.listIncidentRiskLinksUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toIncidentRiskLinkResponse);
  }

  @RequirePermission('incident:link')
  @Post('risks')
  @HttpCode(HttpStatus.CREATED)
  async linkRisk(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Body() body: LinkIncidentRiskRequestDto,
  ): Promise<IncidentRiskLinkResponse> {
    const link = await this.linkIncidentRiskUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      riskId: body.riskId,
    });
    return toIncidentRiskLinkResponse(link);
  }

  @RequirePermission('incident:link')
  @Delete('risks/:linkId')
  @HttpCode(HttpStatus.OK)
  async unlinkRisk(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<IncidentRiskLinkResponse> {
    const unlinked = await this.unlinkIncidentRiskUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      linkId,
    });
    return toIncidentRiskLinkResponse(unlinked);
  }

  // ---------------------------------------------------------------------
  // Assets
  // ---------------------------------------------------------------------

  @RequirePermission('incident:view')
  @Get('assets')
  async listAssetLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly IncidentAssetLinkResponse[]> {
    const links = await this.listIncidentAssetLinksUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toIncidentAssetLinkResponse);
  }

  @RequirePermission('incident:link')
  @Post('assets')
  @HttpCode(HttpStatus.CREATED)
  async linkAsset(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Body() body: LinkIncidentAssetRequestDto,
  ): Promise<IncidentAssetLinkResponse> {
    const link = await this.linkIncidentAssetUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      assetId: body.assetId,
    });
    return toIncidentAssetLinkResponse(link);
  }

  @RequirePermission('incident:link')
  @Delete('assets/:linkId')
  @HttpCode(HttpStatus.OK)
  async unlinkAsset(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<IncidentAssetLinkResponse> {
    const unlinked = await this.unlinkIncidentAssetUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      linkId,
    });
    return toIncidentAssetLinkResponse(unlinked);
  }

  // ---------------------------------------------------------------------
  // Processes
  // ---------------------------------------------------------------------

  @RequirePermission('incident:view')
  @Get('processes')
  async listProcessLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly IncidentProcessLinkResponse[]> {
    const links = await this.listIncidentProcessLinksUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toIncidentProcessLinkResponse);
  }

  @RequirePermission('incident:link')
  @Post('processes')
  @HttpCode(HttpStatus.CREATED)
  async linkProcess(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Body() body: LinkIncidentProcessRequestDto,
  ): Promise<IncidentProcessLinkResponse> {
    const link = await this.linkIncidentProcessUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      processId: body.processId,
    });
    return toIncidentProcessLinkResponse(link);
  }

  @RequirePermission('incident:link')
  @Delete('processes/:linkId')
  @HttpCode(HttpStatus.OK)
  async unlinkProcess(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<IncidentProcessLinkResponse> {
    const unlinked = await this.unlinkIncidentProcessUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      linkId,
    });
    return toIncidentProcessLinkResponse(unlinked);
  }

  // ---------------------------------------------------------------------
  // Problems (READ-ONLY — Problem owns the write path, research.md D-14)
  // ---------------------------------------------------------------------

  @RequirePermission('incident:view')
  @Get('problems')
  async listProblemLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly IncidentProblemLinkResponse[]> {
    const links = await this.listIncidentProblemLinksUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toIncidentProblemLinkResponse);
  }
}
