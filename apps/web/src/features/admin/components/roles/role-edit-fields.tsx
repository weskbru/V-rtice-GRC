'use client';

/**
 * PharosGRC — Administration, the role form rendered inside a panel:
 * editing an existing role (015-roles-permissions-surface FR-027 to FR-032,
 * T042/T043/T044) and composing a new one (Fase 1 de "Novo papel").
 *
 * Editing happens where reading happened — same panel, same visual
 * language, no modal over a modal (FR-027) — and creating now happens in
 * that same panel too, through THIS component rather than through a second
 * form that would have drifted from it (CLAUDE.md §19.4). `role` is the
 * role being edited, or `null` while a new one is being composed; the only
 * differences between the two are which summary sits at the foot of the
 * form and whether anything can be locked at all.
 *
 * The form's own submit/cancel controls live in the panel's fixed footer
 * and reach this `<form>` through its `id`, so the primary action is never
 * scrolled below the fold on a role with the whole catalogue in it.
 *
 * ## A system role is legible and locked, with the reason written
 *
 * Not merely disabled: a greyed control tells the user that something is
 * refused, never why. All THREE fields — name, description and the
 * permission tree — are rendered read-only with `locked.nameReason`,
 * `locked.descriptionReason` and `locked.permissionsReason` in words beside
 * them, under one `locked.platformOwnedNotice` at the top (FR-031, F-68).
 *
 * The description joined the other two on 2026-09-14 (F-68): the platform
 * seed reconciles it on every run, so accepting an edit here gave the field
 * two writers and left the audit trail asserting a state the database did
 * not keep. With nothing writable, the panel around this form offers no save
 * control for a system role at all — this is a definition sheet, not an
 * edit form, and `RoleDetailPanel` labels it accordingly.
 *
 * A role being CREATED can never be in this state — the API forces
 * `isSystem: false` — so nothing here suggests it could.
 *
 * ## The module checkbox is tri-state, in shape as well as in words
 *
 * `Checkbox` gained `indeterminate` for this (015 R-007): "all of this
 * module" and "some of it" must not look the same. The glyph differs in
 * SHAPE (a minus, not a check) and Radix reports `aria-checked="mixed"`;
 * `meta` on the group states the same thing in text — "3 de 9
 * selecionadas" — so the distinction survives greyscale (NFR-004).
 *
 * ## Search narrows what is SHOWN, never what a module toggle means
 *
 * The search box is `PermissionChecklist`'s behaviour, migrated when the
 * create dialog that owned it was replaced by the create panel: it matches
 * the pt-BR verb, resource and module names as well as the raw identifier
 * and the English catalogue description (F-63), which is the only reason
 * typing "Testar" finds `control:test`. What it does NOT do is change the
 * meaning of "Selecionar todas as permissões de Riscos": that control is
 * built from the module's full identifier list, filtered or not, and a
 * notice says so. A module toggle that silently selected only what happened
 * to be on screen would be a trap, not a filter.
 */
import { DisclosureGroup, FormField } from '@pharos/design-system/components';
import { Info, Lock, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { admin } from '@/lib/messages/admin';

import {
  filterPermissionsByQuery,
  groupPermissionsByArea,
  permissionVerbLabel,
} from './permission-grouping';
import { RoleCompositionSummary } from './role-composition-summary';

import type { PermissionArea } from './permission-grouping';
import type { UseRoleEditorResult } from './use-role-editor';
import type { Role } from '../../types';

export interface RoleEditFieldsProps {
  /** The role being edited, or `null` while a new one is composed. */
  role: Role | null;
  editor: UseRoleEditorResult;
  /** The `<form>`'s id — the panel footer's submit button targets it with `form={formId}`. */
  formId: string;
  onSubmit: () => void;
}

/** FR-031 — the reason a field is locked, written out next to it rather than left to be inferred from a disabled control. */
function LockedReason({ reason }: { reason: string }): React.JSX.Element {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
      <Lock aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
      <span>{reason}</span>
    </p>
  );
}

/** FR-029 — what this save will change, before it is made. */
function PendingChanges({
  editor,
  role,
}: {
  editor: UseRoleEditorResult;
  role: Role;
}): React.JSX.Element {
  const messages = admin.roles.edit.pendingChanges;
  const { pending } = editor;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <h4 className="text-sm font-medium text-foreground">{messages.title}</h4>
      {!pending.hasChanges ? (
        <p className="text-xs text-muted-foreground">{messages.none}</p>
      ) : (
        <div className="flex flex-col gap-2 text-xs leading-5 text-muted-foreground">
          {/*
           * Both sides RAW, never the pt-BR label of ADR-022: this line is a
           * diff of the value that will be written to `Role.name`, and only a
           * custom role — whose stored name and label are the same string —
           * can ever reach it. Translating the "from" side would claim a
           * rename the request does not make.
           */}
          {pending.nameChanged ? <p>{messages.nameChanged(role.name, editor.name)}</p> : null}
          {pending.descriptionChanged ? <p>{messages.descriptionChanged}</p> : null}
          {pending.added.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-foreground">
                {messages.addedCount(pending.added.length)}
              </p>
              <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
                {pending.added.map((permission) => (
                  <li key={permission.identifier} className="font-mono">
                    {permission.identifier}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pending.removed.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-foreground">
                {messages.removedCount(pending.removed.length)}
              </p>
              <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
                {pending.removed.map((permission) => (
                  <li key={permission.identifier} className="font-mono">
                    {permission.identifier}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
      {/* FR-030 — a permission change reaches each affected user on their NEXT request; nobody has to sign in again, and nobody's open session keeps the old set forever. */}
      <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
        <span>{admin.roles.form.effectNotice}</span>
      </p>
    </section>
  );
}

export function RoleEditFields({
  role,
  editor,
  formId,
  onSubmit,
}: RoleEditFieldsProps): React.JSX.Element {
  const messages = admin.roles.edit;
  const tree = messages.permissionTree;
  const locked = editor.isLocked;

  const [query, setQuery] = useState('');
  const [openAreas, setOpenAreas] = useState<ReadonlySet<PermissionArea>>(new Set());

  /** Every module of the tree, whatever the search — the source of truth for what a module toggle covers. */
  const allAreas = useMemo(
    () => groupPermissionsByArea(editor.treePermissions),
    [editor.treePermissions],
  );

  /** What the search leaves visible. Equal to `allAreas` while the box is empty. */
  const visibleAreas = useMemo(
    () => groupPermissionsByArea(filterPermissionsByQuery(editor.treePermissions, query)),
    [editor.treePermissions, query],
  );

  const visibleByArea = useMemo(
    () => new Map(visibleAreas.map((area) => [area.area, area])),
    [visibleAreas],
  );

  const visiblePermissionCount = visibleAreas.reduce(
    (total, area) => total + area.permissionCount,
    0,
  );
  const searching = query.trim() !== '';
  const allOpen = visibleAreas.length > 0 && visibleAreas.every((area) => openAreas.has(area.area));

  /**
   * Searching opens the modules that matched, rather than forcing them open
   * for as long as the box has text in it: forced-open groups still report
   * `aria-expanded="true"` after a click that was supposed to collapse them,
   * which is a control that lies. Seeding the same state the toggles own
   * keeps them genuinely collapsible mid-search.
   */
  function handleQueryChange(next: string): void {
    setQuery(next);
    if (next.trim() === '') {
      setOpenAreas(new Set());
      return;
    }
    setOpenAreas(
      new Set(
        groupPermissionsByArea(filterPermissionsByQuery(editor.treePermissions, next)).map(
          (area) => area.area,
        ),
      ),
    );
  }

  function toggleArea(area: PermissionArea, open: boolean): void {
    setOpenAreas((current) => {
      const next = new Set(current);
      if (open) {
        next.add(area);
      } else {
        next.delete(area);
      }
      return next;
    });
  }

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {editor.formError ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {editor.formError}
        </p>
      ) : null}

      {locked ? (
        <p className="flex items-start gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          <span>{messages.locked.platformOwnedNotice}</span>
        </p>
      ) : null}

      {/*
       * What a role IS, and what a created role always is, said once at the
       * top of the form rather than discovered after the fact. The kind
       * notice is a fact of the server (`isSystem: false` is forced), not a
       * choice being offered.
       */}
      {editor.isCreating ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <p className="text-xs leading-5 text-foreground">{admin.roles.create.intro}</p>
          <p className="text-xs leading-5 text-muted-foreground">{admin.roles.create.kindNotice}</p>
        </div>
      ) : null}

      {/* `required` marks a field the USER must fill. On a locked sheet the
          user fills nothing, so the marker would be a demand with no
          addressee (§18.11). */}
      <FormField
        label={messages.fields.name.label}
        required={!locked}
        error={editor.fieldErrors.name}
      >
        {(field) => (
          <div className="flex flex-col gap-1.5">
            {/*
             * `readOnly`, never `disabled`, for a system role's name.
             * FR-031 asks for the field to be LEGIBLE and locked, and the
             * platform's `Input` dims a disabled control to
             * `opacity-50` — measured on screen, the stored name became the
             * faintest text in the panel. `readOnly` keeps full contrast,
             * keeps the field in the tab order, and is announced as
             * read-only rather than simply skipped.
             */}
            <Input
              {...field}
              value={editor.name}
              onChange={(event) => editor.setName(event.target.value)}
              disabled={editor.submitting}
              readOnly={locked}
              className={locked ? 'bg-muted/60' : undefined}
            />
            {locked ? <LockedReason reason={messages.locked.nameReason} /> : null}
          </div>
        )}
      </FormField>

      <FormField
        label={messages.fields.description.label}
        required={!locked}
        error={editor.fieldErrors.description}
      >
        {(field) => (
          <div className="flex flex-col gap-1.5">
            {/*
             * `readOnly`, never `disabled` — the same reasoning as the name
             * field above, and the same reason it was corrected there: a
             * disabled control is dimmed to `opacity-50`, and the seeded
             * description is the longest text in this panel. F-68 locked it;
             * it must stay legible while locked.
             */}
            <Textarea
              {...field}
              rows={3}
              value={editor.description}
              onChange={(event) => editor.setDescription(event.target.value)}
              disabled={editor.submitting}
              readOnly={locked}
              className={locked ? 'bg-muted/60' : undefined}
            />
            {locked ? <LockedReason reason={messages.locked.descriptionReason} /> : null}
          </div>
        )}
      </FormField>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="text-sm font-medium text-foreground">
            {messages.fields.permissions.label}
          </h4>
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-px text-xs leading-4 font-medium text-muted-foreground">
              <Lock aria-hidden="true" className="size-3" />
              {messages.locked.badge}
            </span>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {tree.selectedCount(editor.selected.size)}
          </span>
        </div>

        {locked ? <LockedReason reason={messages.locked.permissionsReason} /> : null}
        {editor.fieldErrors.permissions ? (
          <p role="alert" className="text-xs text-status-danger-fg">
            {editor.fieldErrors.permissions}
          </p>
        ) : null}
        {editor.catalogError ? (
          <p role="alert" className="text-xs text-status-danger-fg">
            {admin.roles.feedback.loadPermissionsError}
          </p>
        ) : null}
        {editor.catalogLoading ? (
          <p className="text-xs text-muted-foreground">{admin.roles.states.loading}</p>
        ) : null}

        {allAreas.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                {/*
                 * `type="text"`, not `type="search"`. Measured on screen:
                 * a search input paints the browser's OWN clear affordance
                 * inside it, so the field showed TWO Xs side by side — one
                 * the platform's, one Chromium's, with different behaviour
                 * and no label. The visible one is ours, which is the one
                 * that carries a pt-BR accessible name.
                 */}
                <Input
                  type="text"
                  aria-label={tree.searchLabel}
                  placeholder={tree.searchPlaceholder}
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  disabled={editor.submitting}
                  className="pr-9 pl-8"
                />
                {searching ? (
                  <button
                    type="button"
                    aria-label={tree.clearSearch}
                    onClick={() => handleQueryChange('')}
                    className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOpenAreas(allOpen ? new Set() : new Set(visibleAreas.map((a) => a.area)))
                }
              >
                {allOpen ? tree.collapseAll : tree.expandAll}
              </Button>
            </div>

            {searching ? (
              <div className="flex flex-col gap-1" aria-live="polite">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {tree.searchResultCount(visiblePermissionCount, editor.treePermissions.length)}
                </p>
                {/* The module toggle keeps meaning "every permission of this module", search or no search. */}
                <p className="text-xs leading-5 text-muted-foreground">{tree.filteredNotice}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {allAreas.length > 0 && visibleAreas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tree.searchEmpty}</p>
        ) : null}

        <div className="flex flex-col gap-2">
          {allAreas.map((area) => {
            const visible = visibleByArea.get(area.area);
            if (!visible) return null;

            // Built from the WHOLE module, never from what the search left
            // on screen: "todas as permissões de Riscos" must mean all of
            // them.
            const identifiers = area.resources.flatMap((resource) =>
              resource.permissions.map((permission) => permission.identifier),
            );
            const selectedCount = identifiers.filter((identifier) =>
              editor.selected.has(identifier),
            ).length;
            const checkedState =
              selectedCount === 0
                ? false
                : selectedCount === identifiers.length
                  ? true
                  : 'indeterminate';
            const selectionText =
              selectedCount === 0
                ? messages.moduleSelection.noneSelected
                : selectedCount === identifiers.length
                  ? messages.moduleSelection.allSelected
                  : messages.moduleSelection.someSelected(selectedCount, identifiers.length);

            return (
              <div
                key={area.area}
                className="flex items-start gap-2 rounded-lg border border-border bg-card pl-3"
              >
                {/*
                 * Outside the disclosure's toggle button on purpose: a
                 * checkbox nested inside a `<button>` is not operable and
                 * not valid. The two controls sit side by side — one selects
                 * the module, the other reveals what is in it.
                 */}
                <Checkbox
                  className="mt-3 shrink-0"
                  checked={checkedState}
                  disabled={locked || editor.submitting}
                  aria-label={messages.moduleSelection.toggleLabel(area.label)}
                  onCheckedChange={(next) => editor.setPermissions(identifiers, next !== false)}
                />
                <DisclosureGroup
                  className="min-w-0 flex-1 rounded-none border-0 bg-transparent"
                  headingLevel={5}
                  title={area.label}
                  meta={
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {selectionText}
                    </span>
                  }
                  open={openAreas.has(area.area)}
                  onOpenChange={(open) => toggleArea(area.area, open)}
                  contentClassName="flex flex-col gap-3"
                >
                  {visible.resources.map((resource) => (
                    <div key={resource.resource} className="flex flex-col gap-1.5">
                      {visible.resources.length > 1 || resource.label !== area.label ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          {resource.label}
                        </p>
                      ) : null}
                      {resource.permissions.map((permission) => (
                        <label
                          key={permission.identifier}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Checkbox
                            className="mt-0.5 shrink-0"
                            checked={editor.selected.has(permission.identifier)}
                            disabled={locked || editor.submitting}
                            onCheckedChange={() => editor.togglePermission(permission.identifier)}
                          />
                          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                            <span className="text-foreground">
                              {permissionVerbLabel(permission)}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {permission.identifier}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </DisclosureGroup>
              </div>
            );
          })}
        </div>
      </section>

      {/*
       * A locked role gets neither summary: "Alterações pendentes: nenhuma"
       * over a form where nothing CAN pend is noise, and the effect notice
       * under it describes a permission change this sheet cannot make (F-68).
       */}
      {locked ? null : role === null ? (
        <RoleCompositionSummary editor={editor} />
      ) : (
        <PendingChanges editor={editor} role={role} />
      )}
    </form>
  );
}
