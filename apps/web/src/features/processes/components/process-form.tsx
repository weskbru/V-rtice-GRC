'use client';

/**
 * PharosGRC — process create/edit form (T048), mirroring
 * `AuditEngagementForm`'s/`ControlForm`'s overall shape (CLAUDE.md §18.12) —
 * simpler than either in two ways that both trace back to `processes.
 * openapi.yaml`, not to a smaller ambition for this screen:
 *
 *   - **No conflict handling.** `processes` carries no `version` column
 *     (`features/processes/types.ts`'s own header comment) — `PATCH
 *     /processes/{processId}` applies last-write-wins directly, so this form
 *     never reads or writes an `ETag` and never renders a 409 banner.
 *   - **No org-unit-scoped assignment picker.** There is no owner field on
 *     this contract at all — only `name`/`description`/`orgUnitId` — so
 *     there is nothing here resembling `ControlForm`'s cascading
 *     assignable-users effect.
 *
 * Organizational unit is required (invariant A1, FR-004) — the field's own
 * `FormField` renders both the required `*` and an explanatory helper
 * (`processes.form.fields.orgUnit.helper`), so the invariant is unmistakable
 * on the screen itself, not only as a validation message after the fact
 * (CLAUDE.md §18.11).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormField, FormSection } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { processesApi } from '../api';

import type {
  ProcessDetail,
  CreateProcessRequest,
  OrgUnitNode,
  UpdateProcessRequest,
} from '../types';
import type { ApiProblem } from '@/lib/api-client';

import { feedback } from '@/components/shell/feedback-provider';
import { useNavigate } from '@/components/shell/navigation-pending';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { processes } from '@/lib/messages/processes';
import { processFormSchema, type ProcessFormValues } from '@/lib/validation/process';

export interface ProcessFormProps {
  mode: 'create' | 'edit';
  process?: ProcessDetail;
  onSaved: (process: ProcessDetail) => void;
  onCancel?: () => void;
}

function defaultValuesFor(process: ProcessDetail | undefined): ProcessFormValues {
  if (!process) {
    return { name: '', description: '', orgUnitId: '' };
  }
  return {
    name: process.name,
    description: process.description ?? '',
    // A process minted before this module existed may carry no
    // organizational unit at all (data-model.md §1/§6) — falls back to
    // unset rather than crashing; `orgUnitId` is still required to SAVE
    // the edit (schema validation), exactly as for a brand-new process.
    orgUnitId: process.orgUnit?.id ?? '',
  };
}

/** The server refuses `description: ''` outright (`MinLength(1)` whenever the property is present) — see `lib/validation/process.ts`'s own header comment. */
function normalizedDescription(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildCreateBody(values: ProcessFormValues): CreateProcessRequest {
  return {
    name: values.name,
    description: normalizedDescription(values.description),
    orgUnitId: values.orgUnitId,
  };
}

function buildUpdateBody(values: ProcessFormValues): UpdateProcessRequest {
  return {
    name: values.name,
    description: normalizedDescription(values.description),
    orgUnitId: values.orgUnitId,
  };
}

export function ProcessForm({
  mode,
  process,
  onSaved,
  onCancel,
}: ProcessFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [orgUnits, setOrgUnits] = useState<OrgUnitNode[] | null>(null);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataReloadToken, setReferenceDataReloadToken] = useState(0);

  const form = useForm<ProcessFormValues>({
    resolver: zodResolver(processFormSchema),
    defaultValues: defaultValuesFor(process),
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const units = await processesApi.listOrgUnits();
        if (!cancelled) {
          setOrgUnits(units);
        }
      } catch {
        if (!cancelled) {
          setReferenceDataError(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingReferenceData(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [referenceDataReloadToken]);

  function handleSubmitError(error: unknown): void {
    if (error instanceof ApiError) {
      const problem: ApiProblem = error.problem;
      if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
        for (const fieldError of problem.errors) {
          if (fieldError.field && fieldError.field in form.getValues()) {
            form.setError(fieldError.field as keyof ProcessFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(processes.form.fixHighlightedFields);
        return;
      }
    }
    setFormError(processes.form.genericError);
  }

  async function onSubmit(values: ProcessFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await processesApi.createProcess(buildCreateBody(values));
        feedback.success(processes.form.createSuccess);
        onSaved(created);
        navigate(`/processes/${created.id}`);
        return;
      }

      const updated = await processesApi.updateProcess(process!.id, buildUpdateBody(values));
      feedback.success(processes.form.updateSuccess);
      onSaved(updated);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || loadingReferenceData;
  const orgUnitOptions = orgUnits ?? [];

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {formError}
        </p>
      ) : null}

      {referenceDataError ? (
        <ErrorState
          message={processes.form.referenceDataError}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReferenceDataReloadToken((token) => token + 1)}
            >
              {common.actions.retry}
            </Button>
          }
        />
      ) : null}

      <FormSection
        title={processes.form.sections.identification.title}
        description={processes.form.sections.identification.description}
      >
        <FormField
          label={processes.form.fields.name.label}
          required
          error={form.formState.errors.name?.message}
        >
          {(field) => <Input {...field} {...form.register('name')} disabled={disabled} />}
        </FormField>

        <FormField
          label={processes.form.fields.description.label}
          optionalIndicator={common.formField.optionalIndicator}
          description={processes.form.fields.description.helper}
          error={form.formState.errors.description?.message}
        >
          {(field) => (
            <Textarea {...field} {...form.register('description')} rows={4} disabled={disabled} />
          )}
        </FormField>

        <Controller
          control={form.control}
          name="orgUnitId"
          render={({ field }) => (
            <FormField
              label={processes.form.fields.orgUnit.label}
              required
              description={processes.form.fields.orgUnit.helper}
              error={form.formState.errors.orgUnitId?.message}
            >
              {(a11y) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger
                    id={a11y.id}
                    className="w-full"
                    aria-describedby={a11y['aria-describedby']}
                    aria-invalid={a11y['aria-invalid']}
                  >
                    <SelectValue placeholder={processes.form.fields.orgUnit.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgUnitOptions.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />
      </FormSection>

      <p className="text-sm text-muted-foreground">{processes.form.unsavedNote}</p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? processes.form.actions.creating
              : processes.form.actions.saveAndCreate
            : submitting
              ? processes.form.actions.saving
              : processes.form.actions.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => (onCancel ? onCancel() : navigate.back())}
        >
          {common.actions.cancel}
        </Button>
      </div>
    </form>
  );
}
