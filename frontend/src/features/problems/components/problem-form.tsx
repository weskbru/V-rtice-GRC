'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { problems } from '@/lib/messages/problems';
import { problemFormSchema, type ProblemFormValues } from '@/lib/validation/problems';
import { ErrorState, FormField, FormSection } from '@vertice/design-system/components';

import { problemsApi } from '../api';
import { todayDateOnly } from '../date';

import type { ProblemDetail, ProblemSeverity } from '../types';
import type { OrgUnitNode, UserRef } from '@/features/risks/types';
import type { ApiProblem } from '@/lib/api-client';

const SEVERITIES: readonly ProblemSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export interface ProblemFormProps {
  mode: 'create' | 'edit';
  problem?: ProblemDetail;
  onSaved: (problem: ProblemDetail) => void;
}

function defaultValuesFor(problem: ProblemDetail | undefined): ProblemFormValues {
  if (!problem) {
    return {
      title: '',
      description: '',
      severity: '',
      orgUnitId: '',
      ownerUserId: '',
      identifiedOn: todayDateOnly(),
    };
  }
  return {
    title: problem.title,
    description: problem.description,
    severity: problem.severity,
    orgUnitId: problem.orgUnit.id,
    ownerUserId: problem.owner.id,
    identifiedOn: problem.identifiedOn,
  };
}

export function ProblemForm({ mode, problem, onSaved }: ProblemFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [orgUnits, setOrgUnits] = useState<OrgUnitNode[] | null>(null);
  const [owner, setOwner] = useState<UserRef | undefined>(problem?.owner);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataReloadToken, setReferenceDataReloadToken] = useState(0);

  const form = useForm<ProblemFormValues>({
    resolver: zodResolver(problemFormSchema),
    defaultValues: defaultValuesFor(problem),
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const units = await problemsApi.listOrgUnits();
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
      const problemDetail: ApiProblem = error.problem;
      if (problemDetail.status === 422 && problemDetail.errors && problemDetail.errors.length > 0) {
        for (const fieldError of problemDetail.errors) {
          if (fieldError.field && fieldError.field in form.getValues()) {
            form.setError(fieldError.field as keyof ProblemFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(problems.form.fixHighlightedFields);
        return;
      }
    }
    setFormError(problems.form.genericError);
  }

  async function onSubmit(values: ProblemFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await problemsApi.create({
          title: values.title,
          description: values.description,
          severity: values.severity as ProblemSeverity,
          orgUnitId: values.orgUnitId,
          identifiedOn: values.identifiedOn,
          ownerUserId: values.ownerUserId || undefined,
        });
        feedback.success(problems.form.createSuccess);
        onSaved(created);
        navigate(`/problems/${created.id}`);
        return;
      }

      const updated = await problemsApi.update(problem!.id, {
        title: values.title,
        description: values.description,
        severity: values.severity as ProblemSeverity,
        ownerUserId: values.ownerUserId || undefined,
      });
      feedback.success(problems.form.updateSuccess);
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
          message={problems.form.referenceDataError}
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
        title={problems.form.sections.identification.title}
        description={problems.form.sections.identification.description}
      >
        <FormField
          label={problems.form.fields.title}
          required
          error={form.formState.errors.title?.message}
        >
          {(field) => <Input {...field} {...form.register('title')} disabled={disabled} />}
        </FormField>

        <FormField
          label={problems.form.fields.description}
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
              label={problems.form.fields.severity}
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
                    <SelectValue placeholder={problems.form.fieldPlaceholders.severity} />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {problems.severityLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />

        <FormField
          label={problems.form.fields.identifiedOn}
          required
          error={form.formState.errors.identifiedOn?.message}
        >
          {(field) => (
            <Input {...field} type="date" {...form.register('identifiedOn')} disabled={disabled} />
          )}
        </FormField>

        {mode === 'create' ? (
          <Controller
            control={form.control}
            name="orgUnitId"
            render={({ field }) => (
              <FormField
                label={problems.form.fields.orgUnit}
                required
                description={problems.form.fieldHelpers.orgUnit}
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
                      <SelectValue placeholder={problems.form.fieldPlaceholders.orgUnit} />
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
        ) : null}

        <Controller
          control={form.control}
          name="ownerUserId"
          render={({ field }) => (
            <FormField
              label={problems.form.fields.owner}
              optionalIndicator={common.formField.optionalIndicator}
              description={problems.form.fieldHelpers.owner}
            >
              {() => (
                <UserPicker
                  value={owner}
                  onChange={(user) => {
                    setOwner(user);
                    field.onChange(user.id);
                  }}
                  onSearch={(q) => problemsApi.searchUsers(q)}
                  disabled={disabled}
                  labels={{
                    placeholder: problems.form.fieldPlaceholders.owner,
                    triggerAriaLabel: problems.form.fields.owner,
                  }}
                />
              )}
            </FormField>
          )}
        />
      </FormSection>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create' ? problems.form.submitCreateLabel : problems.form.submitEditLabel}
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
