'use client';

/**
 * PharosGRC — framework create/edit form (US1), mirroring
 * `features/controls/components/control-form.tsx`'s conflict-handling
 * convention exactly (CLAUDE.md §18.12). Much shorter than `ControlForm`:
 * a framework has no organizational unit, owner or classification fields —
 * just name, description and origin (FR-001).
 *
 * F-56 (`docs/deferred-findings.md`): `name`/`description` are exactly the
 * D-21 shape (`login-form.tsx`'s own header comment has the full mechanism)
 * — text fields reachable as the literal first paint of `/compliance/new`,
 * enabled immediately (no `loadingReferenceData`-style gate unlike
 * `RiskForm`/`ControlForm`/etc., which disable every field until an async
 * fetch resolves well after hydration and are therefore NOT exposed to
 * this defect). A value typed into `name`/`description` before hydration
 * commits can be silently discarded the instant hydration catches up —
 * `react-hook-form`'s `register()` ref-callback churns identity on every
 * render and force-writes its still-empty tracked value onto the DOM on
 * the first post-hydration (re)attach, exactly as `login-form.tsx`
 * diagnoses. Both fields use a plain `useRef` (stable across renders, so
 * React attaches it once and never touches the DOM again) instead of
 * `register()`, and their value is read directly from the DOM at submit
 * time rather than trusted from `react-hook-form`'s tracked state — see
 * `handleSubmit` below. `origin` stays on `react-hook-form`'s `Controller`
 * unchanged: a Radix `Select` cannot be operated before its own JS
 * hydrates, so it was never exposed to this defect and rewriting it would
 * only add risk without closing anything.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField, FormSection } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { complianceApi } from '../api';

import type {
  CreateFrameworkRequest,
  Framework,
  FrameworkOrigin,
  UpdateFrameworkRequest,
} from '../types';
import type { ApiProblem } from '@/lib/api-client';

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
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { frameworkFormSchema, type FrameworkFormValues } from '@/lib/validation/compliance';

export interface FrameworkFormSavedResult {
  framework: Framework;
  etag: string;
}

export interface FrameworkFormProps {
  mode: 'create' | 'edit';
  framework?: Framework;
  /** The `ETag` last read for `framework`. Required when `mode === 'edit'`. */
  etag?: string;
  onSaved: (result: FrameworkFormSavedResult) => void;
  onCancel?: () => void;
}

interface ConflictState {
  currentVersion?: number;
  modifiedAt?: string;
  modifiedBy?: { id: string; fullName: string };
}

function defaultValuesFor(framework: Framework | undefined): FrameworkFormValues {
  if (!framework) {
    return { name: '', description: '', origin: '' };
  }
  return { name: framework.name, description: framework.description, origin: framework.origin };
}

/** `name`/`description` field-level errors, tracked outside `react-hook-form` — see the module header comment (F-56). */
interface UncontrolledFieldErrors {
  name?: string;
  description?: string;
}

function buildRequestBody(
  values: FrameworkFormValues,
): CreateFrameworkRequest & UpdateFrameworkRequest {
  return {
    name: values.name,
    description: values.description,
    origin: values.origin as FrameworkOrigin,
  };
}

export function FrameworkForm({
  mode,
  framework,
  etag,
  onSaved,
  onCancel,
}: FrameworkFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<UncontrolledFieldErrors>({});
  const initialValues = defaultValuesFor(framework);
  // F-56 — plain object refs, stable across renders (unlike `register()`'s
  // ref-callback), so React attaches once at mount and never rewrites the
  // DOM. See the module header comment for the full mechanism.
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const form = useForm<FrameworkFormValues>({
    resolver: zodResolver(frameworkFormSchema),
    defaultValues: initialValues,
  });

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
        const nextFieldErrors: UncontrolledFieldErrors = {};
        for (const fieldError of problem.errors) {
          if (fieldError.field === 'name') {
            nextFieldErrors.name = fieldError.message;
          } else if (fieldError.field === 'description') {
            nextFieldErrors.description = fieldError.message;
          } else if (fieldError.field === 'origin') {
            form.setError('origin', { message: fieldError.message });
          }
        }
        setFieldErrors((previous) => ({ ...previous, ...nextFieldErrors }));
        setFormError(compliance.frameworkForm.fixHighlightedFields);
        return;
      }
    }
    setFormError(compliance.frameworkForm.genericError);
  }

  /**
   * F-56 — replaces `form.handleSubmit(onSubmit)`: `name`/`description`
   * are read directly from the DOM (never from `react-hook-form`'s tracked
   * state, which pre-hydration typing can leave stale — see the module
   * header comment), `origin` still comes from `react-hook-form`. Errors
   * for `name`/`description` go to local `fieldErrors`; `origin` keeps
   * using `form.setError` so its existing `Controller`-driven `FormField`
   * is untouched.
   */
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    form.clearErrors('origin');
    const parsed = frameworkFormSchema.safeParse({
      name: nameRef.current?.value ?? '',
      description: descriptionRef.current?.value ?? '',
      origin: form.getValues('origin'),
    });

    if (!parsed.success) {
      const nextFieldErrors: UncontrolledFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name' && !nextFieldErrors.name) {
          nextFieldErrors.name = issue.message;
        } else if (key === 'description' && !nextFieldErrors.description) {
          nextFieldErrors.description = issue.message;
        } else if (key === 'origin') {
          form.setError('origin', { message: issue.message });
        }
      }
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    void onSubmit(parsed.data);
  }

  async function onSubmit(values: FrameworkFormValues): Promise<void> {
    setFormError(null);
    setConflict(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await complianceApi.createFramework(buildRequestBody(values));
        feedback.success(compliance.frameworkForm.createSuccess);
        onSaved({ framework: result.record, etag: result.etag });
        navigate(`/compliance/${result.record.id}`);
        return;
      }

      const result = await complianceApi.updateFramework(
        framework!.id,
        buildRequestBody(values),
        etag!,
      );
      feedback.success(compliance.frameworkForm.updateSuccess);
      onSaved({ framework: result.record, etag: result.etag });
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAnyway(): Promise<void> {
    if (!conflict?.currentVersion || !framework) {
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      // F-56 — name/description read from the DOM, not `form.getValues()`; see `handleFormSubmit`.
      const values: FrameworkFormValues = {
        name: nameRef.current?.value ?? '',
        description: descriptionRef.current?.value ?? '',
        origin: form.getValues('origin'),
      };
      const ifMatch = `"${conflict.currentVersion}"`;
      const result = await complianceApi.updateFramework(
        framework.id,
        buildRequestBody(values),
        ifMatch,
      );
      setConflict(null);
      feedback.success(compliance.frameworkForm.updateSuccess);
      onSaved({ framework: result.record, etag: result.etag });
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
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

      {conflict ? (
        <Alert variant="destructive">
          <AlertTitle>{compliance.frameworkForm.conflict.title}</AlertTitle>
          <AlertDescription>
            <p>{compliance.frameworkForm.conflict.description}</p>
            {conflict.modifiedAt ? (
              <p>
                {compliance.frameworkForm.conflict.modifiedAt(
                  new Date(conflict.modifiedAt).toLocaleString('pt-BR'),
                )}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {framework ? (
                <Button asChild variant="outline" size="sm" type="button">
                  <a href={`/compliance/${framework.id}`} target="_blank" rel="noopener noreferrer">
                    {compliance.frameworkForm.conflict.reloadAction}
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
                {compliance.frameworkForm.conflict.retryAction}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => setConflict(null)}
              >
                {compliance.frameworkForm.conflict.dismissAction}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <FormSection
        title={compliance.frameworkForm.sections.identification.title}
        description={compliance.frameworkForm.sections.identification.description}
      >
        <FormField
          label={compliance.frameworkForm.fields.name.label}
          required
          error={fieldErrors.name}
        >
          {(field) => (
            <Input
              {...field}
              ref={nameRef}
              name="name"
              defaultValue={initialValues.name}
              disabled={submitting}
            />
          )}
        </FormField>

        <FormField
          label={compliance.frameworkForm.fields.description.label}
          required
          error={fieldErrors.description}
        >
          {(field) => (
            <Textarea
              {...field}
              ref={descriptionRef}
              name="description"
              defaultValue={initialValues.description}
              rows={4}
              disabled={submitting}
            />
          )}
        </FormField>

        <Controller
          control={form.control}
          name="origin"
          render={({ field }) => (
            <FormField
              label={compliance.frameworkForm.fields.origin.label}
              required
              description={compliance.frameworkForm.fields.origin.description}
              error={form.formState.errors.origin?.message}
            >
              {(a11y) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                  <SelectTrigger
                    id={a11y.id}
                    className="w-full"
                    aria-describedby={a11y['aria-describedby']}
                    aria-invalid={a11y['aria-invalid']}
                  >
                    <SelectValue placeholder={compliance.frameworkForm.fields.origin.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXTERNAL_STANDARD">
                      {compliance.originLabels.EXTERNAL_STANDARD}
                    </SelectItem>
                    <SelectItem value="INTERNAL_POLICY">
                      {compliance.originLabels.INTERNAL_POLICY}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />
      </FormSection>

      <p className="text-sm text-muted-foreground">{compliance.frameworkForm.unsavedNote}</p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? compliance.frameworkForm.actions.creating
              : compliance.frameworkForm.actions.saveAndCreate
            : submitting
              ? compliance.frameworkForm.actions.saving
              : compliance.frameworkForm.actions.save}
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
