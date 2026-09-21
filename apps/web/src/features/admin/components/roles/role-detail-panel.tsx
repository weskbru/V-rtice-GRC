'use client';

/**
 * PharosGRC — Administration, the role detail panel
 * (015-roles-permissions-surface FR-009 to FR-012, FR-026 to FR-032,
 * T034/T035).
 *
 * ## Two presentations, one panel
 *
 * Both — inline beside the list at `xl` and wider, an overlay `Sheet` below
 * it — live in `RolePanelShell`, which the create panel uses as well. The
 * reasoning behind the pair, and behind the inline height cap, is written
 * there rather than duplicated here.
 *
 * ## A system role has no edit action at all (F-68)
 *
 * The platform owns a seeded role whole — name, description and permission
 * set — and `RoleAdminService.update` refuses all three. Offering "Editar
 * papel" for one would be a control whose every save the server refuses, so
 * this panel offers "Ver definição" instead: the same three fields, rendered
 * read-only with their reasons in words, and a footer with one way out and
 * no save. The reason is also written beside the actions, in the reading
 * state, so nobody has to open the sheet to learn it.
 *
 * ## The editor stays mounted while reading
 *
 * `useRoleEditor` is called unconditionally. Mounting it only while editing
 * would mean unmounting and remounting the `Sheet` around it below `xl` —
 * i.e. the overlay closing the moment the user pressed "Editar papel". The
 * request it would otherwise make is gated by its own `enabled` flag, so
 * reading a role still costs zero extra requests (NFR-006).
 */
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

/**
 * Why "Excluir" is unavailable for a role, mirroring the server's own two
 * refusals (system role; still assigned). `null` when it can be deleted.
 *
 * The same rule `role-admin-columns.tsx` carried for the table's row menu,
 * moved here with the affordance it explains — the restriction is written
 * out, never merely enforced by a dimmed control
 * (`specs/012-admin-roles-screen/STATE.md` §2.5).
 */
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
  /** Whether the CURRENT user holds `user:administer` — never inferred from `role:administer` (FR-019). */
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
    // FR-032 — nothing is persisted, and the panel returns to reading.
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
          {/* F-68 — a system role opens as a definition sheet, not as an
              edit form, and the heading must not promise otherwise. */}
          {role.isSystem ? admin.roles.edit.viewTitle : admin.roles.edit.title}
        </span>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold text-foreground">{displayName}</h2>
        <RoleTypeTag isSystem={role.isSystem} />
        {privileged ? <RolePrivilegeBadge roleName={displayName} /> : null}
      </div>

      {/*
       * ADR-022, traceability — the heading above is a pt-BR label; THIS is
       * the value the server stores, the API returns and the audit trail
       * records. It rides the same "Ver identificadores técnicos" control
       * that reveals `risk:view` beside each permission (FR-016), because it
       * is the same question asked about a different field, and it is shown
       * for every role — including a custom one, where seeing the two agree
       * is itself the answer.
       */}
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
      /*
       * F-68 — nothing on a system role is writable, so there is NO save
       * control: a button whose every press the server refuses is a promise
       * the product cannot keep, and the one it used to keep (description
       * only) is exactly the defect. One way out, no confirmation to ask for,
       * because nothing was changed.
       */
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
    // Two rows, never one: the panel is 26rem wide and the row would carry a
    // long toggle label, a destructive action, its reason and the primary
    // action. Measured on screen at 1440 px, "Editar papel" wrapped under the
    // rest — the primary action is the one thing that must not look like an
    // afterthought (§18.11, "O usuário identifica imediatamente a ação
    // primária?").
    <div className="flex w-full flex-col gap-2">
      {/* FR-016 — the identifiers are revealed on demand, never rewritten. */}
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
          {/*
           * F-68 — why this role carries no edit action, on its own line and
           * before the controls, so the reader learns it without clicking
           * anything. It replaces the shorter "Papel do sistema" that used to
           * sit beside "Excluir" alone, and covers both refusals at once.
           */}
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
            {/*
             * "Editar papel" is offered only where something can be edited. A
             * system role opens the same fields, read-only, under a name that
             * says so.
             */}
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
