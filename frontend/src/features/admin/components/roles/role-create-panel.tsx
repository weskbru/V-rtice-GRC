'use client';

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
