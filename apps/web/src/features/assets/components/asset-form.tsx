'use client';

/**
 * PharosGRC — asset create/edit form (T048), mirroring
 * `AuditEngagementForm`'s/`ControlForm`'s overall shape (CLAUDE.md §18.12) —
 * simpler than either in two ways that both trace back to `assets.
 * openapi.yaml`, not to a smaller ambition for this screen:
 *
 *   - **No conflict handling.** `assets` carries no `version` column
 *     (`features/assets/types.ts`'s own header comment) — `PATCH
 *     /assets/{assetId}` applies last-write-wins directly, so this form
 *     never reads or writes an `ETag` and never renders a 409 banner.
 *   - **No org-unit-scoped assignment picker.** There is no owner field on
 *     this contract at all — only `name`/`description`/`orgUnitId` — so
 *     there is nothing here resembling `ControlForm`'s cascading
 *     assignable-users effect.
 *
 * Organizational unit is required (invariant A1, FR-004) — the field's own
 * `FormField` renders both the required `*` and an explanatory helper
 * (`assets.form.fields.orgUnit.helper`), so the invariant is unmistakable
 * on the screen itself, not only as a validation message after the fact
 * (CLAUDE.md §18.11).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormField, FormSection } from '@pharos/design-system/components';
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

import { assetsApi } from '../api';

import type { AssetDetail, CreateAssetRequest, OrgUnitNode, UpdateAssetRequest } from '../types';
import type { ApiProblem } from '@/lib/api-client';

export interface AssetFormProps {
  mode: 'create' | 'edit';
  asset?: AssetDetail;
  onSaved: (asset: AssetDetail) => void;
  /**
   * Overrides the "Cancelar" button's default `navigate.back()` (real
   * browser history navigation). Optional — omitted, this form behaves
   * exactly as it always has (`/assets/new`, the register's own create
   * flow). `AssetEditPanel` (022-asset-detail-experience Fase C) passes its
   * own overlay-close here: `navigate.back()` is correct when this form IS
   * the page (a real navigation got you here, so "cancel" means "leave"),
   * but wrong inside an overlay `Sheet`, which is not a navigation at all —
   * exactly the defect the coordinator measured in `ControlForm` (F-79,
   * `docs/deferred-findings.md`) before this same fix was applied here
   * preemptively, rather than shipping the overlay first and finding the
   * same bug a second time. Mirrors `ControlForm`'s/`ActionEditForm`'s own
   * `onCancel?: () => void` contract exactly.
   */
  onCancel?: () => void;
}

function defaultValuesFor(asset: AssetDetail | undefined): AssetFormValues {
  if (!asset) {
    return { name: '', description: '', orgUnitId: '' };
  }
  return {
    name: asset.name,
    description: asset.description ?? '',
    // An asset minted before this module existed may carry no
    // organizational unit at all (data-model.md §1/§6) — falls back to
    // unset rather than crashing; `orgUnitId` is still required to SAVE
    // the edit (schema validation), exactly as for a brand-new asset.
    orgUnitId: asset.orgUnit?.id ?? '',
  };
}

/** The server refuses `description: ''` outright (`MinLength(1)` whenever the property is present) — see `lib/validation/asset.ts`'s own header comment. */
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
