import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditScopeRepositoryPort } from '../domain/ports/audit-scope-repository.port';

import type { AuditScopeEntryRecord } from '../domain/ports/audit-scope-repository.port';

const USER_SELECT = { id: true, fullName: true, email: true } as const;

@Injectable()
export class PrismaAuditScopeRepository implements AuditScopeRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createFrameworkVersionLink(
    auditEngagementId: string,
    frameworkVersionId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }> {
    const created = await this.prisma.client.auditScopeFrameworkVersion.create({
      data: { auditEngagementId, frameworkVersionId, linkedByUserId, linkedAt },
      select: { id: true, linkedAt: true },
    });
    return created;
  }

  async createRequirementLink(
    auditEngagementId: string,
    requirementId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }> {
    const created = await this.prisma.client.auditScopeRequirement.create({
      data: { auditEngagementId, requirementId, linkedByUserId, linkedAt },
      select: { id: true, linkedAt: true },
    });
    return created;
  }

  async createControlLink(
    auditEngagementId: string,
    controlId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }> {
    const created = await this.prisma.client.auditScopeControl.create({
      data: { auditEngagementId, controlId, linkedByUserId, linkedAt },
      select: { id: true, linkedAt: true },
    });
    return created;
  }

  async hasFrameworkVersionLink(
    auditEngagementId: string,
    frameworkVersionId: string,
  ): Promise<boolean> {
    const row = await this.prisma.client.auditScopeFrameworkVersion.findFirst({
      where: { auditEngagementId, frameworkVersionId },
      select: { id: true },
    });
    return row !== null;
  }

  async hasRequirementLink(auditEngagementId: string, requirementId: string): Promise<boolean> {
    const row = await this.prisma.client.auditScopeRequirement.findFirst({
      where: { auditEngagementId, requirementId },
      select: { id: true },
    });
    return row !== null;
  }

  async hasControlLink(auditEngagementId: string, controlId: string): Promise<boolean> {
    const row = await this.prisma.client.auditScopeControl.findFirst({
      where: { auditEngagementId, controlId },
      select: { id: true },
    });
    return row !== null;
  }

  async listScope(auditEngagementId: string): Promise<readonly AuditScopeEntryRecord[]> {
    const [frameworkVersionLinks, requirementLinks, controlLinks] = await Promise.all([
      this.prisma.client.auditScopeFrameworkVersion.findMany({
        where: { auditEngagementId },
        include: {
          frameworkVersion: { select: { id: true, label: true } },
          linkedByUser: { select: USER_SELECT },
        },
        orderBy: { linkedAt: 'desc' },
      }),
      this.prisma.client.auditScopeRequirement.findMany({
        where: { auditEngagementId },
        include: {
          requirement: { select: { id: true, externalRef: true, title: true } },
          linkedByUser: { select: USER_SELECT },
        },
        orderBy: { linkedAt: 'desc' },
      }),
      this.prisma.client.auditScopeControl.findMany({
        where: { auditEngagementId },
        include: {
          control: { select: { id: true, code: true, name: true } },
          linkedByUser: { select: USER_SELECT },
        },
        orderBy: { linkedAt: 'desc' },
      }),
    ]);

    const entries: AuditScopeEntryRecord[] = [
      ...frameworkVersionLinks.map((link): AuditScopeEntryRecord => ({
        id: link.id,
        targetType: 'FRAMEWORK_VERSION',
        target: { id: link.frameworkVersion.id, label: link.frameworkVersion.label },
        linkedAt: link.linkedAt,
        linkedBy: link.linkedByUser,
      })),
      ...requirementLinks.map((link): AuditScopeEntryRecord => ({
        id: link.id,
        targetType: 'REQUIREMENT',
        target: {
          id: link.requirement.id,
          label: `${link.requirement.externalRef} — ${link.requirement.title}`,
        },
        linkedAt: link.linkedAt,
        linkedBy: link.linkedByUser,
      })),
      ...controlLinks.map((link): AuditScopeEntryRecord => ({
        id: link.id,
        targetType: 'CONTROL',
        target: { id: link.control.id, label: `${link.control.code} — ${link.control.name}` },
        linkedAt: link.linkedAt,
        linkedBy: link.linkedByUser,
      })),
    ];

    entries.sort((a, b) => b.linkedAt.getTime() - a.linkedAt.getTime());
    return entries;
  }

  async countScopeLinks(auditEngagementId: string): Promise<number> {
    const [frameworkVersionCount, requirementCount, controlCount] = await Promise.all([
      this.prisma.client.auditScopeFrameworkVersion.count({ where: { auditEngagementId } }),
      this.prisma.client.auditScopeRequirement.count({ where: { auditEngagementId } }),
      this.prisma.client.auditScopeControl.count({ where: { auditEngagementId } }),
    ]);
    return frameworkVersionCount + requirementCount + controlCount;
  }
}
