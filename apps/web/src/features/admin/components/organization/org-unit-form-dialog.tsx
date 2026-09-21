'use client';

/**
 * PharosGRC — Administration, create/edit an organizational unit (T183,
 * FR-024, ADR-004). Reparenting (`edit` mode with a changed `parentId`) is
 * the dangerous operation named in the task brief: it rewrites the
 * materialized path of the unit AND its whole subtree, and can change who
 * can see what across the platform — so a SECOND, explicit confirmation
 * step (`ConfirmDialog`, stating the blast radius) gates it, on top of the
 * ordinary form submit. A plain rename/re-code (no `parentId` change) never
 * shows that second step. A cycle (moving a unit under its own descendant)
 * is excluded from the parent picker client-side (descendants are never
 * offered) AND refused by the server with 422 either way — surfaced
 * intelligibly rather than as a generic failure if it still occurs (e.g. a
 * stale client-side unit list).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ConfirmDialog, FormField } from '@pharos/design-system/components';
import { Loader2, Waypoints } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import {
  NONE_SELECT_VALUE,
  orgUnitFormSchema,
  toNullable,
  type OrgUnitFormValues,
} from '@/lib/validation/admin';

import { adminApi } from '../../api';

import { descendantIdsOf } from './org-unit-tree';

import type { OrgUnitNode } from '../../types';

export type OrgUnitFormMode = 'create-root' | 'create-child' | 'edit';

export interface OrgUnitFormDialogProps {
  mode: OrgUnitFormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required for `create-child`. */
  parent?: OrgUnitNode;
  /** Required for `edit`. */
  unit?: OrgUnitNode;
  allUnits: readonly OrgUnitNode[];
  onSaved: (unit: OrgUnitNode) => void;
}

function titleFor(mode: OrgUnitFormMode, parent: OrgUnitNode | undefined): string {
  if (mode === 'create-root') return admin.organization.form.createRootTitle;
  if (mode === 'create-child') return admin.organization.form.createChildTitle(parent?.name ?? '');
  return admin.organization.form.editTitle;
}

export function OrgUnitFormDialog({
  mode,
  open,
  onOpenChange,
  parent,
  unit,
  allUnits,
  onSaved,
}: OrgUnitFormDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingReparent, setPendingReparent] = useState<OrgUnitFormValues | null>(null);

  const initialParentId = mode === 'create-child' ? (parent?.id ?? '') : (unit?.parentId ?? '');

  const form = useForm<OrgUnitFormValues>({
    resolver: zodResolver(orgUnitFormSchema),
    defaultValues: {
      code: unit?.code ?? '',
      name: unit?.name ?? '',
      parentId: initialParentId,
    },
  });

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      form.reset();
      setFormError(null);
      setPendingReparent(null);
    }
    onOpenChange(next);
  }

  async function submitCreate(values: OrgUnitFormValues): Promise<void> {
    const parentId = mode === 'create-child' ? (parent?.id ?? null) : null;
    const created = await adminApi.createOrgUnit({
      code: values.code,
      name: values.name,
      parentId,
    });
    onSaved(created);
  }

  /** Returns `'saved'`, or `'needs-confirmation'` when reparenting requires the second, explicit confirmation step below — never both throws AND asks for confirmation in the same call. */
  async function submitEdit(
    values: OrgUnitFormValues,
    reparentConfirmed: boolean,
  ): Promise<'saved' | 'needs-confirmation'> {
    if (!unit) return 'saved';
    const nextParentId = toNullable(values.parentId);
    const reparenting = nextParentId !== (unit.parentId ?? null);
    if (reparenting && !reparentConfirmed) {
      setPendingReparent(values);
      return 'needs-confirmation';
    }
    const updated = await adminApi.updateOrgUnit(unit.id, {
      code: values.code,
      name: values.name,
      parentId: nextParentId,
    });
    onSaved(updated);
    return 'saved';
  }

  async function onSubmit(values: OrgUnitFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === 'edit') {
        const result = await submitEdit(values, false);
        if (result === 'needs-confirmation') return; // the reparent ConfirmDialog takes over from here
        handleOpenChange(false);
      } else {
        await submitCreate(values);
        handleOpenChange(false);
      }
    } catch (error) {
      setFormError(errorMessageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReparent(): Promise<void> {
    if (!pendingReparent) return;
    setSubmitting(true);
    try {
      await submitEdit(pendingReparent, true);
      setPendingReparent(null);
      handleOpenChange(false);
    } catch (error) {
      setPendingReparent(null);
      setFormError(errorMessageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  function errorMessageFor(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.problem.status === 409) return admin.organization.form.genericError;
      if (error.problem.status === 422) return admin.organization.reparent.cycleError;
    }
    return admin.organization.form.genericError;
  }

  const excludedParentIds =
    mode === 'edit' && unit
      ? new Set([unit.id, ...descendantIdsOf(allUnits, unit.id)])
      : new Set<string>();
  const parentOptions = allUnits.filter((candidate) => !excludedParentIds.has(candidate.id));

  const descendantCount = unit ? descendantIdsOf(allUnits, unit.id).size : 0;
  const newParentName = pendingReparent
    ? pendingReparent.parentId === NONE_SELECT_VALUE || !pendingReparent.parentId
      ? admin.organization.form.fields.parent.rootOption
      : (allUnits.find((candidate) => candidate.id === pendingReparent.parentId)?.name ?? '')
    : '';

  return (
    <>
      <Dialog open={open && pendingReparent === null} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titleFor(mode, parent)}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event);
            }}
            noValidate
            className="flex flex-col gap-4"
          >
            {formError ? (
              <p
                role="alert"
                className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
              >
                {formError}
              </p>
            ) : null}

            <FormField
              label={admin.organization.form.fields.code.label}
              required
              error={form.formState.errors.code?.message}
            >
              {(field) => <Input {...field} {...form.register('code')} disabled={submitting} />}
            </FormField>

            <FormField
              label={admin.organization.form.fields.name.label}
              required
              error={form.formState.errors.name?.message}
            >
              {(field) => <Input {...field} {...form.register('name')} disabled={submitting} />}
            </FormField>

            {mode === 'edit' ? (
              <Controller
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormField label={admin.organization.form.fields.parent.label}>
                    {(a11y) => (
                      <Select
                        value={field.value || NONE_SELECT_VALUE}
                        onValueChange={field.onChange}
                        disabled={submitting}
                      >
                        <SelectTrigger id={a11y.id} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_SELECT_VALUE}>
                            {admin.organization.form.fields.parent.rootOption}
                          </SelectItem>
                          {parentOptions.map((candidate) => (
                            <SelectItem key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => handleOpenChange(false)}
              >
                {admin.organization.form.cancel}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                {submitting
                  ? admin.organization.form.submitting
                  : mode === 'edit'
                    ? admin.organization.form.submitEdit
                    : admin.organization.form.submitCreate}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingReparent !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingReparent(null);
        }}
        title={admin.organization.reparent.confirmTitle}
        description={
          unit ? admin.organization.reparent.warning(unit.name, descendantCount, newParentName) : ''
        }
        variant="sensitive"
        icon={Waypoints}
        isConfirming={submitting}
        onConfirm={() => void confirmReparent()}
        labels={{
          confirm: admin.organization.reparent.confirm,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
      />
    </>
  );
}
