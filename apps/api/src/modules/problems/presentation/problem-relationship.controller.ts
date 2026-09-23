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
