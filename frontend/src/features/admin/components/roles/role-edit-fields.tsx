'use client';

import { Info, Lock, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { admin } from '@/lib/messages/admin';
import { DisclosureGroup, FormField } from '@vertice/design-system/components';

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
  role: Role | null;
  editor: UseRoleEditorResult;
  formId: string;
  onSubmit: () => void;
}

function LockedReason({ reason }: { reason: string }): React.JSX.Element {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
      <Lock aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
      <span>{reason}</span>
    </p>
  );
}

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

  const allAreas = useMemo(
    () => groupPermissionsByArea(editor.treePermissions),
    [editor.treePermissions],
  );

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

      {editor.isCreating ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <p className="text-xs leading-5 text-foreground">{admin.roles.create.intro}</p>
          <p className="text-xs leading-5 text-muted-foreground">{admin.roles.create.kindNotice}</p>
        </div>
      ) : null}

      <FormField
        label={messages.fields.name.label}
        required={!locked}
        error={editor.fieldErrors.name}
      >
        {(field) => (
          <div className="flex flex-col gap-1.5">
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

      {locked ? null : role === null ? (
        <RoleCompositionSummary editor={editor} />
      ) : (
        <PendingChanges editor={editor} role={role} />
      )}
    </form>
  );
}
