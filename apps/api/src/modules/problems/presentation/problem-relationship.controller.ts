/**
 * 008-incidents-problems, US3 — `ProblemRelationshipController`:
 * `GET`/`POST /problems/{problemId}/risks`,
 * `DELETE /problems/{problemId}/risks/{linkId}`, and the same three
 * shapes for `/incidents` — the fifth link, the N:M pair Problem owns the
 * write path for (`specs/008-incidents-problems/contracts/problems.openapi.yaml`'s
 * "Problem Relationships" operations). Mirrors
 * `grc/finding/presentation/finding-relationship.controller.ts` exactly: a
 * separate controller file from the CRUD/lifecycle `ProblemController`,
 * `200` (not `204`) with the withdrawn link body on unlink — `Problem` has
 * no `version` column to echo via `ETag`.
 *
 * All five routes are gated by `problem:link` (contract's own "Requires
 * `problem:link`..." wording on every write route); the four GET list
 * routes reuse `problem:view`, the same convention
 * `FindingRelationshipController` establishes for its own list routes —
 * the contract states no override for them.
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
  LinkProblemIncidentUseCase,
  ListProblemIncidentLinksUseCase,
  UnlinkProblemIncidentUseCase,
} from '../application/links/link-problem-incident.usecase';
import {
  LinkProblemRiskUseCase,
  ListProblemRiskLinksUseCase,
  UnlinkProblemRiskUseCase,
} from '../application/links/link-problem-risk.usecase';

import { LinkProblemIncidentRequestDto } from './dto/link-problem-incident-request.dto';
import { LinkProblemRiskRequestDto } from './dto/link-problem-risk-request.dto';
import {
  toProblemIncidentLinkResponse,
  toProblemRiskLinkResponse,
  type ProblemIncidentLinkResponse,
  type ProblemRiskLinkResponse,
} from './dto/problem-relationship-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

@Controller('problems/:problemId')
export class ProblemRelationshipController {
  constructor(
    private readonly listProblemRiskLinksUseCase: ListProblemRiskLinksUseCase,
    private readonly linkProblemRiskUseCase: LinkProblemRiskUseCase,
    private readonly unlinkProblemRiskUseCase: UnlinkProblemRiskUseCase,
    private readonly listProblemIncidentLinksUseCase: ListProblemIncidentLinksUseCase,
    private readonly linkProblemIncidentUseCase: LinkProblemIncidentUseCase,
    private readonly unlinkProblemIncidentUseCase: UnlinkProblemIncidentUseCase,
  ) {}

  // ---------------------------------------------------------------------
  // Risks
  // ---------------------------------------------------------------------

  @RequirePermission('problem:view')
  @Get('risks')
  async listRiskLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly ProblemRiskLinkResponse[]> {
    const links = await this.listProblemRiskLinksUseCase.execute({
      actorUserId: session.userId,
      problemId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toProblemRiskLinkResponse);
  }

  @RequirePermission('problem:link')
  @Post('risks')
  @HttpCode(HttpStatus.CREATED)
  async linkRisk(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Body() body: LinkProblemRiskRequestDto,
  ): Promise<ProblemRiskLinkResponse> {
    const link = await this.linkProblemRiskUseCase.execute({
      actorUserId: session.userId,
      problemId,
      riskId: body.riskId,
    });
    return toProblemRiskLinkResponse(link);
  }

  @RequirePermission('problem:link')
  @Delete('risks/:linkId')
  @HttpCode(HttpStatus.OK)
  async unlinkRisk(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<ProblemRiskLinkResponse> {
    const unlinked = await this.unlinkProblemRiskUseCase.execute({
      actorUserId: session.userId,
      problemId,
      linkId,
    });
    return toProblemRiskLinkResponse(unlinked);
  }

  // ---------------------------------------------------------------------
  // Incidents (the N:M pair — Problem owns the write path, D-13 to D-15)
  // ---------------------------------------------------------------------

  @RequirePermission('problem:view')
  @Get('incidents')
  async listIncidentLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly ProblemIncidentLinkResponse[]> {
    const links = await this.listProblemIncidentLinksUseCase.execute({
      actorUserId: session.userId,
      problemId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toProblemIncidentLinkResponse);
  }

  @RequirePermission('problem:link')
  @Post('incidents')
  @HttpCode(HttpStatus.CREATED)
  async linkIncident(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Body() body: LinkProblemIncidentRequestDto,
  ): Promise<ProblemIncidentLinkResponse> {
    const link = await this.linkProblemIncidentUseCase.execute({
      actorUserId: session.userId,
      problemId,
      incidentId: body.incidentId,
    });
    return toProblemIncidentLinkResponse(link);
  }

  @RequirePermission('problem:link')
  @Delete('incidents/:linkId')
  @HttpCode(HttpStatus.OK)
  async unlinkIncident(
    @CurrentSession() session: ValidatedSession,
    @Param('problemId', new ParseUUIDPipe()) problemId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<ProblemIncidentLinkResponse> {
    const unlinked = await this.unlinkProblemIncidentUseCase.execute({
      actorUserId: session.userId,
      problemId,
      linkId,
    });
    return toProblemIncidentLinkResponse(unlinked);
  }
}
