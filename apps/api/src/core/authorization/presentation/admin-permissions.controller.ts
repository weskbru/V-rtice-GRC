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
