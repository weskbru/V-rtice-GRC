'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { feedback } from '@/components/shell/feedback-provider';
import { useNavigate } from '@/components/shell/navigation-pending';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import {
  frameworkVersionFormSchema,
  type FrameworkVersionFormValues,
} from '@/lib/validation/compliance';

import { complianceApi } from '../api';

import type { FrameworkVersion } from '../types';
import type { ApiProblem } from '@/lib/api-client';

export interface FrameworkVersionFormSavedResult {
  version: FrameworkVersion;
  etag: string;
}

export interface FrameworkVersionFormProps {
  mode: 'create' | 'edit';
  frameworkId: string;
  frameworkName: string;
  version?: FrameworkVersion;
  etag?: string;
  onSaved: (result: FrameworkVersionFormSavedResult) => void;
  onCancel?: () => void;
}

interface ConflictState {
  currentVersion?: number;
  modifiedAt?: string;
  modifiedBy?: { id: string; fullName: string };
}

export function FrameworkVersionForm({
  mode,
  frameworkId,
  frameworkName,
  version,
  etag,
  onSaved,
  onCancel,
}: FrameworkVersionFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const form = useForm<FrameworkVersionFormValues>({
    resolver: zodResolver(frameworkVersionFormSchema),
    defaultValues: { label: version?.label ?? '' },
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
      if (problem.status === 422) {
        form.setError('label', { message: compliance.versionForm.labelAlreadyUsedHint });
        setFormError(compliance.versionForm.fixHighlightedFields);
        return;
      }
    }
    setFormError(compliance.versionForm.genericError);
  }

  async function onSubmit(values: FrameworkVersionFormValues): Promise<void> {
    setFormError(null);
    setConflict(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await complianceApi.createFrameworkVersion(frameworkId, {
          label: values.label,
        });
        feedback.success(compliance.versionForm.createSuccess);
        onSaved({ version: result.record, etag: result.etag });
        navigate(`/compliance/${frameworkId}/versions/${result.record.id}`);
        return;
      }

      const result = await complianceApi.updateFrameworkVersion(
        frameworkId,
        version!.id,
        { label: values.label },
        etag!,
      );
      feedback.success(compliance.versionForm.updateSuccess);
      onSaved({ version: result.record, etag: result.etag });
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">
          {compliance.versionForm.createDescription(frameworkName)}
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
          </AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label={compliance.versionForm.fields.label.label}
        required
        description={compliance.versionForm.fields.label.description}
        error={form.formState.errors.label?.message}
      >
        {(field) => <Input {...field} {...form.register('label')} disabled={submitting} />}
      </FormField>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? compliance.versionForm.actions.creating
              : compliance.versionForm.actions.saveAndCreate
            : submitting
              ? compliance.versionForm.actions.saving
              : compliance.versionForm.actions.save}
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
