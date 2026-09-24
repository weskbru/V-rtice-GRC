'use client';

import { DisclosureGroup, EntityTabs } from '@pharos/design-system/components';
import { ConfirmDialog } from '@pharos/design-system/components';
import { Code2, Loader2, Lock, Pencil, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import { roleDisplayName } from '@/lib/role-display-name';

import { RoleEditFields } from './role-edit-fields';
import { roleModuleReach } from './role-filtering';
import { RolePanelShell } from './role-panel-shell';
import { RolePermissionsTab } from './role-permissions-tab';
import { isPrivilegedRole } from './role-privilege';
import { RolePrivilegeBadge } from './role-privilege-badge';
import { RoleTypeTag } from './role-type-tag';
import { RoleUsersTab } from './role-users-tab';
import { useRoleEditor } from './use-role-editor';

import type { Role } from '../../types';

export function roleDeleteBlockedReason(role: Role): string | null {
  if (role.isSystem) return admin.roles.actions.deleteBlockedSystem;
  if (role.assignedUserCount > 0) {
    return admin.roles.actions.deleteBlockedAssigned(role.assignedUserCount);
  }
  return null;
}

export interface RoleDetailPanelProps {
  role: Role;
  canManageRoles: boolean;
  canAdministerUsers: boolean;
  canManageOrgUnits: boolean;
  onClose: () => void;
  onSaved: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function RoleDetailPanel({
  role,
  canManageRoles,
  canAdministerUsers,
  canManageOrgUnits,
  onClose,
  onSaved,
  onDelete,
}: RoleDetailPanelProps): React.JSX.Element {
  const messages = admin.roles.panel;
  const [editing, setEditing] = useState(false);
  const [showIdentifiers, setShowIdentifiers] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const editor = useRoleEditor(role, editing);
  const formId = useId();

  const privileged = isPrivilegedRole(role);
  const displayName = roleDisplayName(role.name);
  const moduleCount = roleModuleReach(role).length;
  const deleteBlockedReason = roleDeleteBlockedReason(role);

  function startEditing(): void {
    editor.reset();
    setEditing(true);
  }

  function discardEditing(): void {
    editor.reset();
    setConfirmCancelOpen(false);
    setEditing(false);
  }

  function requestCancel(): void {
    if (editor.pending.hasChanges) {
      setConfirmCancelOpen(true);
      return;
    }
    discardEditing();
  }

  async function handleSubmit(): Promise<void> {
    const updated = await editor.submit();
    if (!updated) return;
    setEditing(false);
    onSaved(updated);
  }

  const header = (
    <>
      {editing ? (
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {role.isSystem ? admin.roles.edit.viewTitle : admin.roles.edit.title}
        </span>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold text-foreground">{displayName}</h2>
        <RoleTypeTag isSystem={role.isSystem} />
        {privileged ? <RolePrivilegeBadge roleName={displayName} /> : null}
      </div>

      {showIdentifiers && !editing ? (
        <p className="text-xs text-muted-foreground">
          <span>{admin.roles.technicalName.label}: </span>
          <span className="font-mono break-all text-foreground">{role.name}</span>
        </p>
      ) : null}

      {!editing ? (
        <p className="text-sm leading-5 text-muted-foreground">
          {role.description === '' ? messages.noDescription : role.description}
        </p>
      ) : null}

      {privileged && !editing ? (
        <DisclosureGroup
          className="rounded-none border-0 bg-transparent"
          contentClassName="border-t-0 px-0 pb-0"
          title={
            <span className="text-xs font-medium text-muted-foreground">
              {admin.roles.privilege.explanationLabel}
            </span>
          }
        >
          <p className="text-xs leading-5 text-muted-foreground">
            {admin.roles.privilege.explanation}
          </p>
        </DisclosureGroup>
      ) : null}

      {!editing ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{messages.counts.permissions}</dt>
            <dd className="text-lg leading-tight font-semibold text-foreground tabular-nums">
              {role.permissions.length}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{messages.counts.users}</dt>
            <dd className="text-lg leading-tight font-semibold text-foreground tabular-nums">
              {role.assignedUserCount}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{messages.counts.modules}</dt>
            <dd className="text-lg leading-tight font-semibold text-foreground tabular-nums">
              {moduleCount}
            </dd>
          </div>
        </dl>
      ) : null}
    </>
  );

  const body = editing ? (
    <RoleEditFields
      role={role}
      editor={editor}
      formId={formId}
      onSubmit={() => void handleSubmit()}
    />
  ) : (
    <EntityTabs
      ariaLabel={common.entityTabs.sectionsAriaLabel}
      scrollLabels={{
        scrollBack: common.entityTabs.scrollBack,
        scrollForward: common.entityTabs.scrollForward,
      }}
      tabs={[
        {
          id: 'permissions',
          label: messages.tabs.permissions,
          content: <RolePermissionsTab role={role} showIdentifiers={showIdentifiers} />,
        },
        {
          id: 'users',
          label: messages.tabs.users,
          content: (
            <RoleUsersTab
              role={role}
              canAdministerUsers={canAdministerUsers}
              canManageOrgUnits={canManageOrgUnits}
            />
          ),
        },
      ]}
    />
  );

  const footer = editing ? (
    role.isSystem ? (
      <div className="flex w-full justify-end">
        <Button type="button" variant="outline" onClick={discardEditing}>
          {admin.roles.edit.close}
        </Button>
      </div>
    ) : (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={editor.submitting}
          onClick={requestCancel}
        >
          {admin.roles.edit.cancel}
        </Button>
        <Button type="submit" form={formId} disabled={editor.submitting}>
          {editor.submitting ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {editor.submitting ? admin.roles.edit.saving : admin.roles.edit.save}
        </Button>
      </div>
    )
  ) : (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={showIdentifiers}
        onClick={() => setShowIdentifiers((current) => !current)}
        className="w-fit justify-start px-2"
      >
        <Code2 aria-hidden="true" className="size-4" />
        {showIdentifiers
          ? admin.roles.permissionsTab.hideIdentifiers
          : admin.roles.permissionsTab.showIdentifiers}
      </Button>

      {canManageRoles ? (
        <>
          {role.isSystem ? (
            <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              <span>{messages.systemOwnedAction}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {deleteBlockedReason ? (
              <span className="mr-auto text-xs text-muted-foreground">{deleteBlockedReason}</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleteBlockedReason !== null}
              onClick={() => onDelete(role)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {admin.roles.actions.delete}
            </Button>
            {role.isSystem ? (
              <Button type="button" variant="outline" size="sm" onClick={startEditing}>
                <Lock aria-hidden="true" className="size-4" />
                {messages.viewDefinitionAction}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={startEditing}>
                <Pencil aria-hidden="true" className="size-4" />
                {messages.editAction}
              </Button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );

  const cancelConfirm = (
    <ConfirmDialog
      open={confirmCancelOpen}
      onOpenChange={setConfirmCancelOpen}
      title={admin.roles.edit.cancelConfirm.title}
      description={admin.roles.edit.cancelConfirm.description}
      variant="sensitive"
      onConfirm={discardEditing}
      labels={{
        confirm: admin.roles.edit.cancelConfirm.confirm,
        cancel: admin.roles.edit.cancelConfirm.keepEditing,
        close: common.confirmDialog.close,
      }}
    />
  );

  return (
    <>
      <RolePanelShell
        ariaLabel={messages.regionLabel}
        overlayTitle={messages.title}
        closeLabel={messages.closeLabel}
        header={header}
        footer={footer}
        onClose={onClose}
      >
        {body}
      </RolePanelShell>
      {cancelConfirm}
    </>
  );
}
