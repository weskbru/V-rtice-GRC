'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { ConfirmDialog, FormField } from '@vertice/design-system/components';

import { adminApi } from '../../api';

import { descendantIdsOf } from './org-unit-tree';

import type { OrgUnitNode } from '../../types';

export type OrgUnitFormMode = 'create-root' | 'create-child' | 'edit';

export interface OrgUnitFormDialogProps {
  mode: OrgUnitFormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: OrgUnitNode;
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
        if (result === 'needs-confirmation') return;
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
