'use client';

/**
 * PharosGRC — administration, roles and permissions route (T182, US8,
 * FR-022, FR-023; the screen behind it is the roles and permissions
 * surface, `specs/015-roles-permissions-surface`).
 *
 * The route stays a thin mount of `RoleAdminView`: the breadcrumb, page
 * title and primary action all belong to the screen (and, for the
 * breadcrumb, to the shell's own header), so a change of layout never
 * becomes a change of routing.
 */
import { RoleAdminView } from '@/features/admin/components/roles/role-admin-view';

export default function AdminRolesPage(): React.JSX.Element {
  return <RoleAdminView />;
}
