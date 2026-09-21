'use client';

/**
 * PharosGRC — Administration, what a NEW role will grant, counted while it
 * is being composed (Fase 1 de "Novo papel").
 *
 * This is the create-mode counterpart of the edit mode's pending diff. A
 * diff is the wrong instrument here: against a role that does not exist yet
 * every selection is "a acrescentar", which says nothing. What the person
 * composing a role needs is the shape of what they are building — how many
 * permissions, across how many modules, and which modules — plus the three
 * things the form still requires before it can be submitted at all.
 *
 * ## The requirement list is a second channel, not decoration
 *
 * Each requirement carries its state in SHAPE (a filled check circle when
 * met, an empty circle when not) and in WORDS (the accessible name reads
 * "Atendido: …" or "Pendente: …"), never in colour alone — §18.8/NFR-004.
 * The `<ul>` is the list a screen reader walks; the icons are `aria-hidden`
 * and the state travels in the `sr-only` prefix of each item.
 *
 * ## The module taxonomy is the existing one
 *
 * Modules come from `groupPermissionsByArea` over the permissions the person
 * has actually selected — the same `PermissionArea` the list, the module
 * filter, the detail panel and the edit tree use (015 FR-013). There is no
 * second taxonomy here and there must never be one.
 */
import { Check, Circle } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_MAX_LENGTH } from '@/lib/validation/admin';

import { groupPermissionsByArea } from './permission-grouping';

import type { UseRoleEditorResult } from './use-role-editor';

export interface RoleCompositionSummaryProps {
  editor: UseRoleEditorResult;
}

function Requirement({ met, label }: { met: boolean; label: string }): React.JSX.Element {
  const messages = admin.roles.create.requirements;
  return (
    <li className="flex items-start gap-2 text-xs leading-5">
      {met ? (
        <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-status-success-fg" />
      ) : (
        <Circle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      )}
      {/*
       * The state is in the accessible name, not only in the glyph beside
       * it: "Atendido: Um nome, de até 100 caracteres". A reader who cannot
       * see the icon — or who sees it in greyscale — still gets the state.
       */}
      <span className={met ? 'text-foreground' : 'text-muted-foreground'}>
        <span className="sr-only">{met ? messages.met(label) : messages.unmet(label)}</span>
        <span aria-hidden="true">{label}</span>
      </span>
    </li>
  );
}

export function RoleCompositionSummary({ editor }: RoleCompositionSummaryProps): React.JSX.Element {
  const messages = admin.roles.create;

  const selectedPermissions = editor.treePermissions.filter((permission) =>
    editor.selected.has(permission.identifier),
  );
  const modules = groupPermissionsByArea(selectedPermissions);

  const trimmedName = editor.name.trim();
  const trimmedDescription = editor.description.trim();

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-col gap-1.5">
        <h4 className="text-sm font-medium text-foreground">{messages.composition.title}</h4>
        {selectedPermissions.length === 0 ? (
          <p className="text-xs leading-5 text-muted-foreground">{messages.composition.none}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-foreground tabular-nums">
              <span className="font-semibold">
                {messages.composition.permissionCount(selectedPermissions.length)}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {messages.composition.moduleCount(modules.length)}
              </span>
            </p>
            <ul className="flex flex-wrap gap-1" aria-label={messages.composition.modulesLabel}>
              {modules.map((module_) => (
                <li
                  key={module_.area}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-px text-xs leading-5 text-muted-foreground"
                >
                  <span className="text-foreground">{module_.label}</span>
                  <span className="tabular-nums">{module_.permissionCount}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
        <h4 className="text-xs font-medium text-foreground">{messages.requirements.title}</h4>
        <ul className="flex flex-col gap-1">
          <Requirement
            met={trimmedName !== '' && editor.name.length <= ROLE_NAME_MAX_LENGTH}
            label={messages.requirements.name}
          />
          <Requirement
            met={
              trimmedDescription !== '' && editor.description.length <= ROLE_DESCRIPTION_MAX_LENGTH
            }
            label={messages.requirements.description}
          />
          <Requirement met={editor.selected.size > 0} label={messages.requirements.permissions} />
        </ul>
      </div>
    </section>
  );
}
