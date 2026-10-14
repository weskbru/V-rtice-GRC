'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';
import { assetFormSchema, type AssetFormValues } from '@/lib/validation/asset';
import { ErrorState, FormField, FormSection } from '@vertice/design-system/components';

import { assetsApi } from '../api';

import type { AssetDetail, CreateAssetRequest, OrgUnitNode, UpdateAssetRequest } from '../types';
import type { ApiProblem } from '@/lib/api-client';

export interface AssetFormProps {
  mode: 'create' | 'edit';
  asset?: AssetDetail;
  onSaved: (asset: AssetDetail) => void;
  onCancel?: () => void;
}

function defaultValuesFor(asset: AssetDetail | undefined): AssetFormValues {
  if (!asset) {
    return { name: '', description: '', orgUnitId: '' };
  }
  return {
    name: asset.name,
    description: asset.description ?? '',
    orgUnitId: asset.orgUnit?.id ?? '',
  };
}

function normalizedDescription(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildCreateBody(values: AssetFormValues): CreateAssetRequest {
  return {
    name: values.name,
    description: normalizedDescription(values.description),
    orgUnitId: values.orgUnitId,
  };
}

function buildUpdateBody(values: AssetFormValues): UpdateAssetRequest {
  return {
    name: values.name,
    description: normalizedDescription(values.description),
    orgUnitId: values.orgUnitId,
  };
}

export function AssetForm({ mode, asset, onSaved, onCancel }: AssetFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [orgUnits, setOrgUnits] = useState<OrgUnitNode[] | null>(null);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataReloadToken, setReferenceDataReloadToken] = useState(0);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: defaultValuesFor(asset),
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const units = await assetsApi.listOrgUnits();
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
            form.setError(fieldError.field as keyof AssetFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(assets.form.fixHighlightedFields);
        return;
      }
    }
    setFormError(assets.form.genericError);
  }

  async function onSubmit(values: AssetFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await assetsApi.createAsset(buildCreateBody(values));
        feedback.success(assets.form.createSuccess);
        onSaved(created);
        navigate(`/assets/${created.id}`);
        return;
      }

      const updated = await assetsApi.updateAsset(asset!.id, buildUpdateBody(values));
      feedback.success(assets.form.updateSuccess);
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
          message={assets.form.referenceDataError}
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
        title={assets.form.sections.identification.title}
        description={assets.form.sections.identification.description}
      >
        <FormField
          label={assets.form.fields.name.label}
          required
          error={form.formState.errors.name?.message}
        >
          {(field) => <Input {...field} {...form.register('name')} disabled={disabled} />}
        </FormField>

        <FormField
          label={assets.form.fields.description.label}
          optionalIndicator={common.formField.optionalIndicator}
          description={assets.form.fields.description.helper}
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
              label={assets.form.fields.orgUnit.label}
              required
              description={assets.form.fields.orgUnit.helper}
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
                    <SelectValue placeholder={assets.form.fields.orgUnit.placeholder} />
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

      <p className="text-sm text-muted-foreground">{assets.form.unsavedNote}</p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? assets.form.actions.creating
              : assets.form.actions.saveAndCreate
            : submitting
              ? assets.form.actions.saving
              : assets.form.actions.save}
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
