'use client';

/**
 * PharosGRC — report creation form (009-indicators-reports, T061, US5), mirroring
 * `features/compliance/components/framework-form.tsx`'s conflict-free shape (CLAUDE.md §18.12):
 * name, description, plus a checklist of the closed `IndicatorMetricKey` catalog. Create-only —
 * `updateReportDefinition` exists in the contract but is deliberately not implemented
 * (`ReportController`'s own header comment), so there is no edit form to share this component
 * with.
 *
 * The metric checklist reuses `indicators.metricKeyLabels` (`lib/messages/indicators.ts`) rather
 * than declaring a second copy of the eleven labels — the coordinator's own instruction for this
 * task, and consistent with `metric-visuals.ts`'s own header on when duplication vs. reuse applies
 * (labels are catalog data meant to be shared; icons/colors are a purely cosmetic mapping that
 * gets duplicated instead).
 *
 * F-56 (`docs/deferred-findings.md`): `name`/`description` are the D-21 shape
 * (`login-form.tsx`'s own header comment has the full mechanism, mirrored by
 * `framework-form.tsx`'s identical fix) — text fields reachable as the
 * literal first paint of `/reports/new`, enabled immediately (no
 * `loadingReferenceData`-style gate). A value typed before hydration
 * commits can be silently discarded the instant hydration catches up, via
 * `register()`'s unstable ref-callback identity. Both fields use a plain
 * `useRef` instead of `register()`, read directly from the DOM at submit
 * time — see `handleFormSubmit` below. `metricKeys` stays on
 * `react-hook-form`'s `Controller`: a `Checkbox` cannot be toggled before
 * its own JS hydrates, so it was never exposed to this defect.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField, FormSection } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { feedback } from '@/components/shell/feedback-provider';
import { useNavigate } from '@/components/shell/navigation-pending';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';
import { reports } from '@/lib/messages/reports';

import { reportsApi } from '../api';
import { REPORT_METRIC_ICON } from '../metric-visuals';
import { reportFormSchema, type ReportFormValues } from '../validation';

import type { ReportDefinition } from '../types';

const METRIC_KEYS = Object.keys(REPORT_METRIC_ICON) as readonly (keyof typeof REPORT_METRIC_ICON)[];

export interface ReportFormProps {
  onCreated: (report: ReportDefinition) => void;
}

/** `name`/`description` field-level errors, tracked outside `react-hook-form` — see the module header comment (F-56). */
interface UncontrolledFieldErrors {
  name?: string;
  description?: string;
}

export function ReportForm({ onCreated }: ReportFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<UncontrolledFieldErrors>({});
  // F-56 — plain object refs, stable across renders (unlike `register()`'s
  // ref-callback), so React attaches once at mount and never rewrites the
  // DOM. See the module header comment for the full mechanism.
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { name: '', description: '', metricKeys: [] },
  });

  async function onSubmit(values: ReportFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await reportsApi.createDefinition({
        name: values.name,
        description: values.description,
        metricKeys: values.metricKeys as ReportDefinition['metricKeys'],
      });
      feedback.success(reports.form.createSuccess(created.name));
      onCreated(created);
      navigate('/reports');
    } catch (error) {
      if (error instanceof ApiError) {
        const problem = error.problem;
        if (problem.status === 400 && problem.errors && problem.errors.length > 0) {
          const nextFieldErrors: UncontrolledFieldErrors = {};
          for (const fieldError of problem.errors) {
            if (fieldError.field === 'name') {
              nextFieldErrors.name = fieldError.message;
            } else if (fieldError.field === 'description') {
              nextFieldErrors.description = fieldError.message;
            } else if (fieldError.field === 'metricKeys') {
              form.setError('metricKeys', { message: fieldError.message });
            }
          }
          setFieldErrors((previous) => ({ ...previous, ...nextFieldErrors }));
          setFormError(reports.form.fixHighlightedFields);
          setSubmitting(false);
          return;
        }
      }
      setFormError(reports.form.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * F-56 — replaces `form.handleSubmit(onSubmit)`: `name`/`description`
   * are read directly from the DOM (never from `react-hook-form`'s tracked
   * state, which pre-hydration typing can leave stale — see the module
   * header comment), `metricKeys` still comes from `react-hook-form`.
   * Errors for `name`/`description` go to local `fieldErrors`;
   * `metricKeys` keeps using `form.setError` so its existing
   * `Controller`-driven `FormField` is untouched.
   */
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    form.clearErrors('metricKeys');
    const parsed = reportFormSchema.safeParse({
      name: nameRef.current?.value ?? '',
      description: descriptionRef.current?.value ?? '',
      metricKeys: form.getValues('metricKeys'),
    });

    if (!parsed.success) {
      const nextFieldErrors: UncontrolledFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name' && !nextFieldErrors.name) {
          nextFieldErrors.name = issue.message;
        } else if (key === 'description' && !nextFieldErrors.description) {
          nextFieldErrors.description = issue.message;
        } else if (key === 'metricKeys') {
          form.setError('metricKeys', { message: issue.message });
        }
      }
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    void onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-6">
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {formError}
        </p>
      ) : null}

      <FormSection
        title={reports.form.sections.identification.title}
        description={reports.form.sections.identification.description}
      >
        <FormField label={reports.form.fields.name.label} required error={fieldErrors.name}>
          {(field) => (
            <Input {...field} ref={nameRef} name="name" defaultValue="" disabled={submitting} />
          )}
        </FormField>

        <FormField
          label={reports.form.fields.description.label}
          required
          error={fieldErrors.description}
        >
          {(field) => (
            <Textarea
              {...field}
              ref={descriptionRef}
              name="description"
              defaultValue=""
              rows={3}
              disabled={submitting}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection
        title={reports.form.sections.metrics.title}
        description={reports.form.sections.metrics.description}
      >
        <Controller
          control={form.control}
          name="metricKeys"
          render={({ field }) => {
            const selected = new Set(field.value);
            function toggle(key: string): void {
              const next = new Set(selected);
              if (next.has(key)) {
                next.delete(key);
              } else {
                next.add(key);
              }
              field.onChange(Array.from(next));
            }
            return (
              <FormField
                label={reports.form.fields.metricKeys.label}
                required
                error={form.formState.errors.metricKeys?.message}
              >
                {() => (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      {reports.form.fields.metricKeys.selectedCount(selected.size)}
                    </p>
                    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
                      {METRIC_KEYS.map((key) => (
                        <div key={key} className="flex items-start gap-2">
                          <Checkbox
                            id={`metric-${key}`}
                            checked={selected.has(key)}
                            onCheckedChange={() => toggle(key)}
                            disabled={submitting}
                          />
                          <Label htmlFor={`metric-${key}`} className="font-normal text-foreground">
                            {indicators.metricKeyLabels[key]}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </FormField>
            );
          }}
        />
      </FormSection>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {submitting ? reports.form.actions.creating : reports.form.actions.saveAndCreate}
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
