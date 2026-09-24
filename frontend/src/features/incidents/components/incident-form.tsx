'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormField, FormSection } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { UserPicker } from '@/components/directory/user-picker';
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
import { incidents } from '@/lib/messages/incidents';
import { incidentFormSchema, type IncidentFormValues } from '@/lib/validation/incidents';

import { incidentsApi } from '../api';

import type {
  CreateIncidentRequest,
  IncidentDetail,
  IncidentSeverity,
  UpdateIncidentRequest,
  UserRef,
} from '../types';
import type { OrgUnitNode } from '@/features/risks/types';
import type { ApiProblem } from '@/lib/api-client';

const SEVERITIES: readonly IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const NONE_OWNER_VALUE = '__none__';

export interface IncidentFormProps {
  mode: 'create' | 'edit';
  incident?: IncidentDetail;
  onSaved: (incident: IncidentDetail) => void;
}

function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultValuesFor(incident: IncidentDetail | undefined): IncidentFormValues {
  if (!incident) {
    return {
      title: '',
      description: '',
      severity: '',
      orgUnitId: '',
      ownerUserId: NONE_OWNER_VALUE,
      reportedOn: todayDateOnly(),
    };
  }
  return {
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    orgUnitId: incident.orgUnit.id,
    ownerUserId: incident.owner.id,
    reportedOn: incident.reportedOn,
  };
}

function buildCreateBody(values: IncidentFormValues): CreateIncidentRequest {
  return {
    title: values.title,
    description: values.description,
    severity: values.severity as IncidentSeverity,
    orgUnitId: values.orgUnitId,
    reportedOn: values.reportedOn,
    ownerUserId: values.ownerUserId === NONE_OWNER_VALUE ? undefined : values.ownerUserId,
  };
}

function buildUpdateBody(values: IncidentFormValues): UpdateIncidentRequest {
  return {
    title: values.title,
    description: values.description,
    severity: values.severity as IncidentSeverity,
    ownerUserId: values.ownerUserId === NONE_OWNER_VALUE ? undefined : values.ownerUserId,
  };
}

export function IncidentForm({ mode, incident, onSaved }: IncidentFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [orgUnits, setOrgUnits] = useState<OrgUnitNode[] | null>(null);
  const [owner, setOwner] = useState<UserRef | undefined>(incident?.owner);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataReloadToken, setReferenceDataReloadToken] = useState(0);

  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: defaultValuesFor(incident),
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const units = await incidentsApi.listOrgUnits();
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
            form.setError(fieldError.field as keyof IncidentFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(incidents.form.fixHighlightedFields);
        return;
      }
      if (problem.status === 404 || problem.status === 403) {
        setFormError(incidents.form.outOfScopeError);
        return;
      }
    }
    setFormError(mode === 'create' ? incidents.form.createError : incidents.form.updateError);
  }

  async function onSubmit(values: IncidentFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await incidentsApi.create(buildCreateBody(values));
        feedback.success(incidents.form.createSuccess);
        onSaved(created);
        navigate(`/incidents/${created.id}`);
        return;
      }

      const updated = await incidentsApi.update(incident!.id, buildUpdateBody(values));
      feedback.success(incidents.form.updateSuccess);
      onSaved(updated);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || loadingReferenceData;
  const orgUnitOptions = orgUnits ?? [];
  const isEdit = mode === 'edit';

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
          message={incidents.form.referenceDataError}
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
        title={incidents.form.sections.identification.title}
        description={incidents.form.sections.identification.description}
      >
        <FormField
          label={incidents.form.fields.title.label}
          required
          error={form.formState.errors.title?.message}
        >
          {(field) => <Input {...field} {...form.register('title')} disabled={disabled} />}
        </FormField>

        <FormField
          label={incidents.form.fields.description.label}
          required
          error={form.formState.errors.description?.message}
        >
          {(field) => (
            <Textarea {...field} {...form.register('description')} rows={4} disabled={disabled} />
          )}
        </FormField>

        <Controller
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormField
              label={incidents.form.fields.severity.label}
              required
              error={form.formState.errors.severity?.message}
            >
              {(a11y) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger
                    id={a11y.id}
                    className="w-full"
                    aria-describedby={a11y['aria-describedby']}
                    aria-invalid={a11y['aria-invalid']}
                  >
                    <SelectValue placeholder={incidents.form.fields.severity.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {incidents.severityLabels[severity]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />

        <Controller
          control={form.control}
          name="orgUnitId"
          render={({ field }) => (
            <FormField
              label={incidents.form.fields.orgUnit.label}
              required
              description={isEdit ? incidents.form.fields.orgUnit.helperImmutable : undefined}
              error={form.formState.errors.orgUnitId?.message}
            >
              {(a11y) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled || isEdit}
                >
                  <SelectTrigger
                    id={a11y.id}
                    className="w-full"
                    aria-describedby={a11y['aria-describedby']}
                    aria-invalid={a11y['aria-invalid']}
                  >
                    <SelectValue placeholder={incidents.form.fields.orgUnit.placeholder} />
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

        <Controller
          control={form.control}
          name="ownerUserId"
          render={({ field }) => (
            <FormField
              label={incidents.form.fields.owner.label}
              optionalIndicator={common.formField.optionalIndicator}
              description={incidents.form.fields.owner.helper}
            >
              {() => (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <UserPicker
                      value={owner}
                      onChange={(user) => {
                        setOwner(user);
                        field.onChange(user.id);
                      }}
                      onSearch={(q) => incidentsApi.searchUsers(q)}
                      disabled={disabled}
                      labels={{
                        placeholder: incidents.form.fields.owner.placeholder,
                        triggerAriaLabel: incidents.form.fields.owner.label,
                      }}
                    />
                  </div>
                  {owner ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => {
                        setOwner(undefined);
                        field.onChange(NONE_OWNER_VALUE);
                      }}
                    >
                      {incidents.form.fields.owner.placeholder}
                    </Button>
                  ) : null}
                </div>
              )}
            </FormField>
          )}
        />

        <FormField
          label={incidents.form.fields.reportedOn.label}
          required
          error={form.formState.errors.reportedOn?.message}
        >
          {(field) => (
            <Input {...field} {...form.register('reportedOn')} type="date" disabled={disabled} />
          )}
        </FormField>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create' ? incidents.form.submitCreateLabel : incidents.form.submitEditLabel}
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
