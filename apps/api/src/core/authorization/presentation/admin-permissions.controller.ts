/**
 * T180 — `AdminPermissionsController`: `GET /admin/permissions`
 * (`contracts/admin.openapi.yaml`'s `Permissions` tag). Requires
 * `role:administer` (same permission as role administration — the
 * catalogue exists to support role composition and is read-only over the
 * API, per that document's own description).
 */
import { Controller, Get, Query } from '@nestjs/common';

import { RoleAdminService } from '../application/role-admin.service';

import { ListPermissionsQueryDto } from './dto/list-permissions-query.dto';
import { toPermissionResponse, type PermissionResponse } from './dto/role-response.mapper';
import { RequirePermission } from './permission.guard';

@Controller('admin/permissions')
export class AdminPermissionsController {
  constructor(private readonly roleAdmin: RoleAdminService) {}

  @RequirePermission('role:administer')
  @Get()
  async list(@Query() query: ListPermissionsQueryDto): Promise<readonly PermissionResponse[]> {
    const permissions = await this.roleAdmin.listPermissions(query.resource);
    return permissions.map(toPermissionResponse);
  }
}
