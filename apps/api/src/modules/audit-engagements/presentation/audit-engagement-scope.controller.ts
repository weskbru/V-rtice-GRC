/**
 * T040/005-audit-findings, User Story 1 — `AuditEngagementScopeController`:
 * `contracts/audit.openapi.yaml`'s `/audits/{auditId}/scope[/framework-versions|
 * /requirements|/controls]` paths (`listAuditScope`, `addFrameworkVersionToScope`,
 * `addRequirementToScope`, `addControlToScope` — operations 5-8 of 11).
 *
 * ## Why the three `add*ToScope` handlers re-read the scope after writing
 *
 * `LinkAuditScopeTo*UseCase.execute()` returns only `{id, linkedAt}`
 * (`AuditScopeLinkResult`, `application/scope/link-framework-version.usecase.ts`)
 * — the minimum the WRITE side needs. The `201` response this contract
 * declares is the full `AuditScopeEntry` (`targetType`, `target.label`,
 * `linkedBy`), which only the READ side
 * (`AuditScopeRepositoryPort.listScope`, via `ListAuditScopeUseCase`)
 * computes — `target.label` in particular is a joined, precomputed string
 * (`FrameworkVersion.label` / `"{externalRef} — {title}"` /
 * `"{code} — {name}"`, `prisma-audit-scope.repository.ts`'s own header)
 * that no write-path method returns. Rather than duplicate that
 * computation here (a second place `target.label`'s format could drift
 * from `listAuditScope`'s own), this controller composes the two existing
 * use cases: link, then re-read the engagement's scope and pick out the
 * entry whose `id` the link call just returned — an unpaginated, bounded
 * read (research.md's own "an engagement's scope is bounded by what a
 * human explicitly added"), consistent BY CONSTRUCTION with what
 * `GET /audits/{auditId}/scope` would show immediately afterward.
 */
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

  /** `listAuditScope`. */
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

  /** `addFrameworkVersionToScope`. */
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

  /** `addRequirementToScope`. */
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

  /** `addControlToScope`. */
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

  /** See this file's header for why the `201` body is built by re-reading
   * the scope rather than by the link use case's own minimal result. */
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
    // Defensive only: the link just committed in the SAME request, inside
    // the same transaction that has since closed — it cannot be absent
    // from an immediately following read of the same (append-only,
    // research.md D-12) table.
    if (!entry) {
      throw new Error(`Scope link ${linkId} not found immediately after being created.`);
    }
    return toAuditScopeEntryResponse(entry);
  }
}
