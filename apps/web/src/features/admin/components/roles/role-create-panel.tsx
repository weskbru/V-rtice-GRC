'use client';

/**
 * PharosGRC — Administration, composing a NEW role (Fase 1 de "Novo
 * papel").
 *
 * ## Why this is a panel and not the dialog it replaces
 *
 * Until now creating a role opened `RoleCreateDialog`: a modal carrying a
 * flat `PermissionChecklist`, with no module state, no idea how much of the
 * platform the role would reach, and no statement of what the form
 * required. 015 rebuilt reading and editing as a panel beside the list with
 * a module tree and a tri-state selector, and left creation behind — so the
 * screen spoke two visual languages, one of them retired.
 *
 * It now speaks one. The create panel is the SAME `RolePanelShell` the
 * detail panel uses (inline at `xl`, an overlay `Sheet` below it, with the
 * same focus contract), and the SAME `RoleEditFields` over the SAME
 * `useRoleEditor` — `null` target instead of a role. Nothing about
 * composing a role is written twice (CLAUDE.md §19.4).
 *
 * ## The counts live in the fixed header
 *
 * The body scrolls — fourteen modules and seventy permissions do not fit —
 * so "what will this role grant" belongs where it cannot scroll away. The
 * two figures in the header are the same ones the detail panel shows for a
 * stored role, in the same idiom, computed live from the current selection.
 *
 * ## A created role is never a system role
 *
 * `prisma-role.repository.ts:69` forces `isSystem: false`, so there is no
 * kind to choose, nothing here is ever locked, and the form says so in
 * words (`create.kindNotice`) rather than offering a control that would do
 * nothing.
 */
import { ConfirmDialog } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';

import { groupPermissionsByArea } from './permission-grouping';
import { RoleEditFields } from './role-edit-fields';
import { RolePanelShell } from './role-panel-shell';
import { useRoleEditor } from './use-role-editor';

import type { Role } from '../../types';

export interface RoleCreatePanelProps {
  onClose: () => void;
  onCreated: (role: Role) => void;
}

export function RoleCreatePanel({ onClose, onCreated }: RoleCreatePanelProps): React.JSX.Element {
  const messages = admin.roles.create;
  const editor = useRoleEditor(null, true);
  const formId = useId();
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const selectedPermissions = editor.treePermissions.filter((permission) =>
    editor.selected.has(permission.identifier),
  );
  const moduleCount = groupPermissionsByArea(selectedPermissions).length;

  function requestClose(): void {
    // Nothing is persisted either way; the question exists so a half-composed
    // role is not lost to a stray click on the backdrop or the close button.
    if (editor.pending.hasChanges) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  }

  function discard(): void {
    editor.reset();
    setConfirmDiscardOpen(false);
    onClose();
  }

  async function handleSubmit(): Promise<void> {
    const created = await editor.submit();
    if (!created) return;
    onCreated(created);
  }

  const header = (
    <>
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {messages.title}
      </span>

      {/*
       * The subject, not the action: the eyebrow above already says "NOVO
       * PAPEL", and repeating it here said nothing twice. Until a name is
       * typed the heading is an explicit placeholder, dimmed so it does not
       * read as a stored value, and it becomes the real name as the person
       * types it.
       */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2
          className={
            editor.name.trim() === ''
              ? 'text-base font-semibold text-muted-foreground italic'
              : 'text-base font-semibold text-foreground'
          }
        >
          {editor.name.trim() === '' ? messages.unnamed : editor.name}
        </h2>
      </div>

      {/* Live, and fixed: the body scrolls past fourteen modules, this does not. */}
      <dl className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">{admin.roles.panel.counts.permissions}</dt>
          <dd className="text-lg leading-tight font-semibold text-foreground tabular-nums">
            {selectedPermissions.length}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">{admin.roles.panel.counts.modules}</dt>
          <dd className="text-lg leading-tight font-semibold text-foreground tabular-nums">
            {moduleCount}
          </dd>
        </div>
      </dl>
    </>
  );

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" disabled={editor.submitting} onClick={requestClose}>
        {messages.cancel}
      </Button>
      <Button type="submit" form={formId} disabled={editor.submitting}>
        {editor.submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {editor.submitting ? messages.submitting : messages.submit}
      </Button>
    </div>
  );

  return (
    <>
      <RolePanelShell
        ariaLabel={messages.regionLabel}
        overlayTitle={messages.title}
        closeLabel={messages.closeLabel}
        header={header}
        footer={footer}
        onClose={requestClose}
      >
        <RoleEditFields
          role={null}
          editor={editor}
          formId={formId}
          onSubmit={() => void handleSubmit()}
        />
      </RolePanelShell>

      <ConfirmDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        title={messages.discardConfirm.title}
        description={messages.discardConfirm.description}
        variant="sensitive"
        onConfirm={discard}
        labels={{
          confirm: messages.discardConfirm.confirm,
          cancel: messages.discardConfirm.keepEditing,
          close: common.confirmDialog.close,
        }}
      />
    </>
  );
}
