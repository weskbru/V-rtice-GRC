import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { LinkAuditScopeToControlUseCase } from '../application/scope/link-control.usecase';
import { LinkAuditScopeToFrameworkVersionUseCase } from '../application/scope/link-framework-version.usecase';
import { LinkAuditScopeToRequirementUseCase } from '../application/scope/link-requirement.usecase';
import { ListAuditScopeUseCase } from '../application/scope/list-audit-scope.usecase';

import { AddControlScopeRequestDto } from './dto/add-control-scope-request.dto';
import { AddFrameworkVersionScopeRequestDto } from './dto/add-framework-version-scope-request.dto';
import { AddRequirementScopeRequestDto } from './dto/add-requirement-scope-request.dto';
import {
  toAuditScopeEntryResponse,
  type AuditScopeEntryResponse,
} from './dto/audit-scope-entry-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { AuditScopeEntryRecord } from '../domain/ports/audit-scope-repository.port';

@Controller('audits/:auditId/scope')
export class AuditEngagementScopeController {
  constructor(
    private readonly linkFrameworkVersionUseCase: LinkAuditScopeToFrameworkVersionUseCase,
    private readonly linkRequirementUseCase: LinkAuditScopeToRequirementUseCase,
    private readonly linkControlUseCase: LinkAuditScopeToControlUseCase,
    private readonly listAuditScopeUseCase: ListAuditScopeUseCase,
  ) {}

  @RequirePermission('audit-engagement:view')
  @Get()
  async listScope(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
  ): Promise<readonly AuditScopeEntryResponse[]> {
    const entries = await this.listAuditScopeUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
    });
    return entries.map(toAuditScopeEntryResponse);
  }

  @RequirePermission('audit-engagement:scope')
  @Post('framework-versions')
  @HttpCode(HttpStatus.CREATED)
  async addFrameworkVersion(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Body() body: AddFrameworkVersionScopeRequestDto,
  ): Promise<AuditScopeEntryResponse> {
    const link = await this.linkFrameworkVersionUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      frameworkVersionId: body.frameworkVersionId,
    });
    return this.rereadEntry(session, auditId, link.id);
  }

  @RequirePermission('audit-engagement:scope')
  @Post('requirements')
  @HttpCode(HttpStatus.CREATED)
  async addRequirement(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Body() body: AddRequirementScopeRequestDto,
  ): Promise<AuditScopeEntryResponse> {
    const link = await this.linkRequirementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      requirementId: body.requirementId,
    });
    return this.rereadEntry(session, auditId, link.id);
  }

  @RequirePermission('audit-engagement:scope')
  @Post('controls')
  @HttpCode(HttpStatus.CREATED)
  async addControl(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Body() body: AddControlScopeRequestDto,
  ): Promise<AuditScopeEntryResponse> {
    const link = await this.linkControlUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      controlId: body.controlId,
    });
    return this.rereadEntry(session, auditId, link.id);
  }

  private async rereadEntry(
    session: ValidatedSession,
    auditId: string,
    linkId: string,
  ): Promise<AuditScopeEntryResponse> {
    const entries = await this.listAuditScopeUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
    });
    const entry = entries.find((candidate: AuditScopeEntryRecord) => candidate.id === linkId);
    if (!entry) {
      throw new Error(`Scope link ${linkId} not found immediately after being created.`);
    }
    return toAuditScopeEntryResponse(entry);
  }
}
