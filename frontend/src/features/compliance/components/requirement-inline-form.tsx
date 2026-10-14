'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { requirementFormSchema, type RequirementFormValues } from '@/lib/validation/compliance';
import { FormField, FormSection } from '@vertice/design-system/components';

import { complianceApi } from '../api';

import type { Requirement } from '../types';

export interface RequirementInlineFormSavedResult {
  requirement: Requirement;
  etag: string;
}

export interface RequirementInlineFormProps {
  mode: 'create' | 'edit';
  frameworkId: string;
  versionId: string;
  requirement?: Requirement;
  etag?: string;
  onSaved: (result: RequirementInlineFormSavedResult) => void;
  onCancel?: () => void;
}

export function RequirementInlineForm({
  mode,
  frameworkId,
  versionId,
  requirement,
  etag,
  onSaved,
  onCancel,
}: RequirementInlineFormProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RequirementFormValues>({
    resolver: zodResolver(requirementFormSchema),
    defaultValues: {
      externalRef: requirement?.externalRef ?? '',
      title: requirement?.title ?? '',
      description: requirement?.description ?? '',
    },
  });

  async function onSubmit(values: RequirementFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await complianceApi.createRequirement(frameworkId, versionId, values);
        feedback.success(compliance.requirements.createSuccess);
        form.reset({ externalRef: '', title: '', description: '' });
        onSaved({ requirement: result.record, etag: result.etag });
        return;
      }

      const result = await complianceApi.updateRequirement(requirement!.id, values, etag!);
      feedback.success(compliance.requirements.updateSuccess);
      onSaved({ requirement: result.record, etag: result.etag });
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 422 && error.problem.errors) {
        for (const fieldError of error.problem.errors) {
          if (fieldError.field && fieldError.field in form.getValues()) {
            form.setError(fieldError.field as keyof RequirementFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(compliance.requirements.fixHighlightedFields);
        return;
      }
      setFormError(
        error instanceof ApiError
          ? (error.problem.detail ?? compliance.requirements.genericError)
          : compliance.requirements.genericError,
      );
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

      <FormSection
        title={
          mode === 'create'
            ? compliance.requirements.createFormTitle
            : compliance.requirements.editFormTitle
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <FormField
            label={compliance.requirements.fields.externalRef.label}
            required
            description={compliance.requirements.fields.externalRef.description}
            error={form.formState.errors.externalRef?.message}
          >
            {(field) => (
              <Input {...field} {...form.register('externalRef')} disabled={submitting} />
            )}
          </FormField>

          <FormField
            label={compliance.requirements.fields.title.label}
            required
            error={form.formState.errors.title?.message}
          >
            {(field) => <Input {...field} {...form.register('title')} disabled={submitting} />}
          </FormField>
        </div>

        <FormField
          label={compliance.requirements.fields.description.label}
          required
          error={form.formState.errors.description?.message}
        >
          {(field) => (
            <Textarea {...field} {...form.register('description')} rows={3} disabled={submitting} />
          )}
        </FormField>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? compliance.requirements.actions.creating
              : compliance.requirements.actions.saveAndCreate
            : submitting
              ? compliance.requirements.actions.saving
              : compliance.requirements.actions.save}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
            {mode === 'edit' ? compliance.requirements.actions.cancelEdit : common.actions.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
