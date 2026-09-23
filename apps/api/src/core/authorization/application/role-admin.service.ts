import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome } from '@prisma/client';

import {
  ConflictDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import {
  PermissionRepositoryPort,
  type PermissionRecord,
} from '../domain/ports/permission-repository.port';
import {
  RoleRepositoryPort,
  type ListRolesResult,
  type RoleRecord,
  type SetDiff,
} from '../domain/ports/role-repository.port';

const ROLE_ENTITY_LABEL = 'Papel';

export interface CreateRoleCommand {
  readonly actorUserId: string;
  readonly name: string;
  readonly description: string;
  readonly permissionIdentifiers: readonly string[];
}

export interface UpdateRoleCommand {
  readonly actorUserId: string;
  readonly roleId: string;
  readonly name?: string;
  readonly description?: string;
  readonly permissionIdentifiers?: readonly string[];
}

export interface ReplaceUserRolesCommand {
  readonly actorUserId: string;
  readonly userId: string;
  readonly roleIds: readonly string[];
}

@Injectable()
export class RoleAdminService {
  constructor(
    private readonly roleRepository: RoleRepositoryPort,
    private readonly permissionRepository: PermissionRepositoryPort,
    private readonly actorDirectory: ActorDirectoryPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  private async resolveActorLabel(actorUserId: string): Promise<string> {
    const label = await this.actorDirectory.findActorLabel(actorUserId);
    if (!label) {
      throw new UnauthorizedDomainError();
    }
    return label;
  }

  async list(page: number, pageSize: number): Promise<ListRolesResult> {
    return this.roleRepository.list(page, pageSize);
  }

  async getById(roleId: string): Promise<RoleRecord> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundDomainError(ROLE_ENTITY_LABEL, roleId);
    }
    return role;
  }

  async listPermissions(resource: string | undefined): Promise<readonly PermissionRecord[]> {
    return this.permissionRepository.listAll(resource);
  }

  async create(command: CreateRoleCommand): Promise<RoleRecord> {
    const actorLabel = await this.resolveActorLabel(command.actorUserId);
    const resolvedPermissions = await this.resolvePermissionIdentifiers(
      command.permissionIdentifiers,
    );

    const existingByName = await this.roleRepository.findByName(command.name);
    if (existingByName) {
      throw new ConflictDomainError(USER_MESSAGES.admin.roleNameAlreadyInUse);
    }

    return this.transactionRunner.run(async () => {
      const role = await this.roleRepository.create({
        name: command.name,
        description: command.description,
        permissionIds: resolvedPermissions.map((permission) => permission.id),
      });

      await this.auditRecorder.record({
        action: 'role.created',
        entityType: AuditEntityType.ROLE,
        entityId: role.id,
        actorLabel,
        newValues: { name: role.name, description: role.description, isSystem: role.isSystem },
        outcome: AuditOutcome.SUCCESS,
      });

      await this.auditPermissionDiff(
        role.id,
        { added: resolvedPermissions.map((permission) => permission.id), removed: [] },
        actorLabel,
      );

      return role;
    });
  }

  async update(command: UpdateRoleCommand): Promise<RoleRecord> {
    const actorLabel = await this.resolveActorLabel(command.actorUserId);
    const role = await this.getById(command.roleId);

    if (
      role.isSystem &&
      (command.name !== undefined ||
        command.description !== undefined ||
        command.permissionIdentifiers !== undefined)
    ) {
      throw new ValidationDomainError(USER_MESSAGES.admin.systemRoleImmutable);
    }

    if (command.name !== undefined) {
      const conflict = await this.roleRepository.findByName(command.name, command.roleId);
      if (conflict) {
        throw new ConflictDomainError(USER_MESSAGES.admin.roleNameAlreadyInUse);
      }
    }

    const resolvedPermissions =
      command.permissionIdentifiers !== undefined
        ? await this.resolvePermissionIdentifiers(command.permissionIdentifiers)
        : undefined;

    await this.transactionRunner.run(async () => {
      if (command.name !== undefined || command.description !== undefined) {
        const previous = await this.roleRepository.updateFields(command.roleId, {
          ...(command.name !== undefined ? { name: command.name } : {}),
          ...(command.description !== undefined ? { description: command.description } : {}),
        });
        await this.auditRecorder.record({
          action: 'role.updated',
          entityType: AuditEntityType.ROLE,
          entityId: command.roleId,
          actorLabel,
          previousValues: {
            ...(command.name !== undefined ? { name: previous?.name } : {}),
            ...(command.description !== undefined ? { description: previous?.description } : {}),
          },
          newValues: {
            ...(command.name !== undefined ? { name: command.name } : {}),
            ...(command.description !== undefined ? { description: command.description } : {}),
          },
          outcome: AuditOutcome.SUCCESS,
        });
      }

      if (resolvedPermissions !== undefined) {
        const diff = await this.roleRepository.replaceRolePermissions(
          command.roleId,
          resolvedPermissions.map((permission) => permission.id),
        );
        if (diff.added.length > 0 || diff.removed.length > 0) {
          await this.permissionRepository.bumpPermissionsVersion();
          await this.auditPermissionDiff(command.roleId, diff, actorLabel);
        }
      }
    });

    return this.getById(command.roleId);
  }

  async delete(roleId: string, actorUserId: string): Promise<void> {
    const actorLabel = await this.resolveActorLabel(actorUserId);
    const role = await this.getById(roleId);

    if (role.isSystem) {
      throw new ValidationDomainError(USER_MESSAGES.admin.systemRoleNotDeletable);
    }
    if (role.assignedUserCount > 0) {
      throw new ValidationDomainError(USER_MESSAGES.admin.roleHasAssignedUsers);
    }

    await this.transactionRunner.run(async () => {
      await this.auditRecorder.record({
        action: 'role.deleted',
        entityType: AuditEntityType.ROLE,
        entityId: roleId,
        actorLabel,
        previousValues: { name: role.name, description: role.description, isSystem: role.isSystem },
        outcome: AuditOutcome.SUCCESS,
      });
      await this.roleRepository.delete(roleId);
    });
  }

  async replaceUserRoles(command: ReplaceUserRolesCommand): Promise<SetDiff> {
    const actorLabel = await this.resolveActorLabel(command.actorUserId);

    if (command.roleIds.length > 0) {
      const found = await this.roleRepository.findByIds(command.roleIds);
      if (found.length !== new Set(command.roleIds).size) {
        throw new ValidationDomainError(USER_MESSAGES.admin.invalidRoleIds);
      }
    }

    return this.transactionRunner.run(async () => {
      const grantedAt = new Date();
      const diff = await this.roleRepository.replaceUserRoles(
        command.userId,
        command.roleIds,
        command.actorUserId,
        grantedAt,
      );

      if (diff.added.length > 0 || diff.removed.length > 0) {
        await this.permissionRepository.bumpPermissionsVersion();
      }

      for (const roleId of diff.added) {
        await this.auditRecorder.record({
          action: 'user_role.granted',
          entityType: AuditEntityType.USER_ROLE,
          entityId: command.userId,
          actorLabel,
          newValues: {
            userId: command.userId,
            roleId,
            grantedByUserId: command.actorUserId,
            grantedAt,
          },
          outcome: AuditOutcome.SUCCESS,
        });
      }
      for (const roleId of diff.removed) {
        await this.auditRecorder.record({
          action: 'user_role.revoked',
          entityType: AuditEntityType.USER_ROLE,
          entityId: command.userId,
          actorLabel,
          previousValues: { userId: command.userId, roleId },
          outcome: AuditOutcome.SUCCESS,
        });
      }

      return diff;
    });
  }

  private async resolvePermissionIdentifiers(
    identifiers: readonly string[],
  ): Promise<readonly PermissionRecord[]> {
    if (identifiers.length === 0) {
      return [];
    }
    const resolved = await this.permissionRepository.findByIdentifiers(identifiers);
    if (resolved.length !== new Set(identifiers).size) {
      throw new ValidationDomainError(USER_MESSAGES.admin.invalidPermissionIdentifiers);
    }
    return resolved;
  }

  private async auditPermissionDiff(
    roleId: string,
    diff: SetDiff,
    actorLabel: string,
  ): Promise<void> {
    for (const permissionId of diff.added) {
      await this.auditRecorder.record({
        action: 'role_permission.granted',
        entityType: AuditEntityType.ROLE_PERMISSION,
        entityId: roleId,
        actorLabel,
        newValues: { roleId, permissionId },
        outcome: AuditOutcome.SUCCESS,
      });
    }
    for (const permissionId of diff.removed) {
      await this.auditRecorder.record({
        action: 'role_permission.revoked',
        entityType: AuditEntityType.ROLE_PERMISSION,
        entityId: roleId,
        actorLabel,
        previousValues: { roleId, permissionId },
        outcome: AuditOutcome.SUCCESS,
      });
    }
  }
}
