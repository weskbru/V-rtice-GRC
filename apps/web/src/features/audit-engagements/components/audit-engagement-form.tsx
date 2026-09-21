'use client';

/**
 * PharosGRC — audit engagement create/edit form (T076), mirroring
 * `ControlForm`'s/`RiskForm`'s conflict-handling convention exactly
 * (CLAUDE.md §18.12).
 *
 * ## Editable only in `PLANNING` (research.md D-3/D-13, quickstart.md §2 step 4)
 *
 * `PATCH /audits/{auditId}` answers `422` once the engagement has left
 * `PLANNING`. The detail view (`AuditEngagementDetailView`) never renders
 * this form in `mode="edit"` unless `engagement.status === 'PLANNING'` —
 * so the server is never asked for a transition it has already refused to
 * offer (CLAUDE.md §18.11: "não oferecer uma affordance de edição que o
 * servidor vai recusar"). This form still surfaces
 * `auditEngagements.form.editNotPlanningNotice` as a standing, proactive
 * reminder at the top of the edit form — not only as a reactive error —
 * because the fact itself ("this becomes permanently fixed the moment the
 * engagement starts") is useful to know WHILE still editable, not only
 * after the door has already closed.
 *
 * ## Lead auditor picker uses the PLAIN browse listing, never an
 * org-unit-scoped assignment listing
 *
 * Unlike `ControlForm`'s/`RiskForm`'s owner pickers, `leadAuditorUserId`
 * carries no organizational-assignment constraint server-side —
 * `CreateAuditEngagementUseCase.assertLeadAuditorAssignable` (apps/api)
 * only requires the chosen user to be active. See `../api.ts`'s own
 * reference-data section header for the full reasoning; this form's picker
 * therefore needs no cascading re-fetch keyed to the selected org unit.
 *
 * ## Conflict handling (ADR-013 equivalent)
 *
 * Identical to `ControlForm`/`RiskForm`: on a `409` nothing in the form is
 * reset — a banner explains the conflict and offers "ver versão atual",
 * "salvar mesmo assim" and "continuar editando", never a silent reload.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormField, FormSection } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { UserPicker } from '@/components/directory/user-picker';
import { feedback } from '@/components/shell/feedback-provider';
import { useNavigate } from '@/components/shell/navigation-pending';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import {
  auditEngagementFormSchema,
  type AuditEngagementFormValues,
} from '@/lib/validation/audit-engagement';

import { auditEngagementsApi } from '../api';
import { formatTimestamp } from '../date';

import type {
  AuditEngagement,
  CreateAuditEngagementRequest,
  OrgUnitNode,
  UpdateAuditEngagementRequest,
  UserRef,
} from '../types';
import type { ApiProblem } from '@/lib/api-client';

export interface AuditEngagementFormProps {
  mode: 'create' | 'edit';
  /** Required, and used as the initial values, when `mode === 'edit'`. */
  engagement?: AuditEngagement;
  /** The `ETag` last read for `engagement` (ADR-013). Required when `mode === 'edit'`. */
  etag?: string;
  /** Called after a successful create or update with the fresh record and its new `ETag`. */
  onSaved: (result: { engagement: AuditEngagement; etag: string }) => void;
}

interface ReferenceData {
  orgUnits: OrgUnitNode[];
}

interface ConflictState {
  currentVersion?: number;
  modifiedAt?: string;
  modifiedBy?: { id: string; fullName: string };
}

function defaultValuesFor(engagement: AuditEngagement | undefined): AuditEngagementFormValues {
  if (!engagement) {
    return {
      objective: '',
      periodStart: '',
      periodEnd: '',
      orgUnitId: '',
      leadAuditorUserId: '',
    };
  }
  return {
    objective: engagement.objective,
    periodStart: engagement.periodStart,
    periodEnd: engagement.periodEnd,
    orgUnitId: engagement.orgUnit.id,
    leadAuditorUserId: engagement.leadAuditor.id,
  };
}

function buildCreateBody(values: AuditEngagementFormValues): CreateAuditEngagementRequest {
  return {
    objective: values.objective,
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
    orgUnitId: values.orgUnitId,
    leadAuditorUserId: values.leadAuditorUserId,
  };
}

function buildUpdateBody(values: AuditEngagementFormValues): UpdateAuditEngagementRequest {
  return {
    objective: values.objective,
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
    orgUnitId: values.orgUnitId,
    leadAuditorUserId: values.leadAuditorUserId,
  };
}

export function AuditEngagementForm({
  mode,
  engagement,
  etag,
  onSaved,
}: AuditEngagementFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataReloadToken, setReferenceDataReloadToken] = useState(0);

  const form = useForm<AuditEngagementFormValues>({
    resolver: zodResolver(auditEngagementFormSchema),
    defaultValues: defaultValuesFor(engagement),
  });

  // S-10: the lead auditor is now picked via server-side search
  // (`UserPicker`), not a preloaded, bounded list — so its current LABEL is
  // tracked separately, seeded from `engagement.leadAuditor` in edit mode
  // (already carries its own `fullName`, never re-fetched).
  const [leadAuditor, setLeadAuditor] = useState<UserRef | undefined>(engagement?.leadAuditor);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const orgUnits = await auditEngagementsApi.listOrgUnits();
        if (!cancelled) {
          setReferenceData({ orgUnits });
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
      if (problem.status === 409) {
        setConflict({
          currentVersion: problem.currentVersion,
          modifiedAt: problem.modifiedAt,
          modifiedBy: problem.modifiedBy,
        });
        return;
      }
      if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
        for (const fieldError of problem.errors) {
          if (fieldError.field && fieldError.field in form.getValues()) {
            form.setError(fieldError.field as keyof AuditEngagementFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(auditEngagements.form.fixHighlightedFields);
        return;
      }
    }
    setFormError(auditEngagements.form.genericError);
  }

  async function onSubmit(values: AuditEngagementFormValues): Promise<void> {
    setFormError(null);
    setConflict(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await auditEngagementsApi.createEngagement(buildCreateBody(values));
        feedback.success(auditEngagements.form.createSuccess);
        onSaved(result);
        navigate(`/audits/${result.engagement.id}`);
        return;
      }

      const result = await auditEngagementsApi.updateEngagement(
        engagement!.id,
        buildUpdateBody(values),
        etag!,
      );
      feedback.success(auditEngagements.form.updateSuccess);
      onSaved(result);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAnyway(): Promise<void> {
    if (!conflict?.currentVersion || !engagement) {
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const values = form.getValues();
      const ifMatch = `"${conflict.currentVersion}"`;
      const result = await auditEngagementsApi.updateEngagement(
        engagement.id,
        buildUpdateBody(values),
        ifMatch,
      );
      setConflict(null);
      feedback.success(auditEngagements.form.updateSuccess);
      onSaved(result);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || loadingReferenceData;
  const orgUnitOptions = referenceData?.orgUnits ?? [];

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {mode === 'edit' ? (
        <p
          role="status"
          className="rounded-md border border-status-info-border bg-status-info-bg px-3 py-2 text-sm text-status-info-fg"
        >
          {auditEngagements.form.editNotPlanningNotice}
        </p>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {formError}
        </p>
      ) : null}

      {conflict ? (
        <Alert variant="destructive">
          <AlertTitle>{auditEngagements.form.conflict.title}</AlertTitle>
          <AlertDescription>
            <p>{auditEngagements.form.conflict.description}</p>
            {conflict.modifiedBy ? (
              <p>{auditEngagements.form.conflict.modifiedBy(conflict.modifiedBy.fullName)}</p>
            ) : null}
            {conflict.modifiedAt ? (
              <p>
                {auditEngagements.form.conflict.modifiedAt(formatTimestamp(conflict.modifiedAt))}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {engagement ? (
                <Button asChild variant="outline" size="sm" type="button">
                  <a href={`/audits/${engagement.id}`} target="_blank" rel="noopener noreferrer">
                    {auditEngagements.form.conflict.reloadAction}
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={submitting}
                onClick={() => {
                  void saveAnyway();
                }}
              >
                {auditEngagements.form.conflict.retryAction}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => setConflict(null)}
              >
                {auditEngagements.form.conflict.dismissAction}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {referenceDataError ? (
        <ErrorState
          message={auditEngagements.form.referenceDataError}
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
        title={auditEngagements.form.sections.identification.title}
        description={auditEngagements.form.sections.identification.description}
      >
        <FormField
          label={auditEngagements.form.fields.objective.label}
          required
          description={auditEngagements.form.fields.objective.description}
          error={form.formState.errors.objective?.message}
        >
          {(field) => (
            <Textarea {...field} {...form.register('objective')} rows={4} disabled={disabled} />
          )}
        </FormField>
      </FormSection>

      <FormSection
        title={auditEngagements.form.sections.scheduling.title}
        description={auditEngagements.form.sections.scheduling.description}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={auditEngagements.form.fields.periodStart.label}
            required
            error={form.formState.errors.periodStart?.message}
          >
            {(field) => (
              <Input type="date" {...field} {...form.register('periodStart')} disabled={disabled} />
            )}
          </FormField>

          <FormField
            label={auditEngagements.form.fields.periodEnd.label}
            required
            error={form.formState.errors.periodEnd?.message}
          >
            {(field) => (
              <Input type="date" {...field} {...form.register('periodEnd')} disabled={disabled} />
            )}
          </FormField>
        </div>

        <Controller
          control={form.control}
          name="orgUnitId"
          render={({ field }) => (
            <FormField
              label={auditEngagements.form.fields.orgUnit.label}
              required
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
                    <SelectValue placeholder={auditEngagements.form.fields.orgUnit.placeholder} />
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

        <div className="flex flex-col gap-2">
          <Controller
            control={form.control}
            name="leadAuditorUserId"
            render={({ field }) => (
              <FormField
                label={auditEngagements.form.fields.leadAuditor.label}
                required
                error={form.formState.errors.leadAuditorUserId?.message}
              >
                {() => (
                  <UserPicker
                    value={leadAuditor}
                    onChange={(user) => {
                      setLeadAuditor(user);
                      field.onChange(user.id);
                    }}
                    onSearch={(q) => auditEngagementsApi.searchUsers(q)}
                    disabled={disabled}
                    labels={{
                      placeholder: auditEngagements.form.fields.leadAuditor.placeholder,
                      triggerAriaLabel: auditEngagements.form.fields.leadAuditor.label,
                    }}
                  />
                )}
              </FormField>
            )}
          />
        </div>
      </FormSection>

      <p className="text-sm text-muted-foreground">{auditEngagements.form.unsavedNote}</p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? auditEngagements.form.actions.creating
              : auditEngagements.form.actions.saveAndCreate
            : submitting
              ? auditEngagements.form.actions.saving
              : auditEngagements.form.actions.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => navigate.back()}
        >
          {common.actions.cancel}
        </Button>
      </div>
    </form>
  );
}
