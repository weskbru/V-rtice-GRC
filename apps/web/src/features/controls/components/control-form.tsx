'use client';

/**
 * PharosGRC — control create/edit form (T046), mirroring `risk-form.tsx`'s
 * conflict-handling and owner-picker conventions exactly (CLAUDE.md
 * §18.12).
 *
 * ## Owner picker uses the ASSIGNMENT listing (T046's own explicit
 * requirement)
 *
 * `ownerUserId` MUST resolve against `controlsApi.listUsers({
 * assignableForOrgUnitId })` — never the browse listing — for the same
 * reason `RiskForm` was fixed to do this: a scoped analyst must not see an
 * empty owner picker just because the browse listing (restricted to the
 * CALLER's own scope) happens not to include anyone from the control's
 * (possibly different) organizational unit.
 *
 * ## Owner is optional here (FR-005) — unlike Risk's required owner
 *
 * A control may be created and remain in `DRAFT` with no owner at all; the
 * owner only becomes required when the record enters `ACTIVE`
 * (`ControlLifecycleActions` surfaces that precondition). The picker is
 * therefore never marked `required` and the schema never rejects an empty
 * value — this is the one structural difference from `RiskForm`'s owner
 * field.
 *
 * ## Conflict handling (ADR-013 equivalent)
 *
 * Identical to `RiskForm`: on a `409` nothing in the form is reset: a
 * banner explains the conflict and offers "ver versão atual",
 * "salvar mesmo assim" and "continuar editando" — never a silent reload.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorState, FormField, FormSection } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

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
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';
import {
  NONE_SELECT_VALUE,
  controlFormSchema,
  toNullable,
  type ControlFormValues,
} from '@/lib/validation/control';

import { controlsApi } from '../api';

import type {
  ControlDetail,
  ControlFrequency,
  ControlNature,
  ControlType,
  CreateControlRequest,
  OrgUnitNode,
  UpdateControlRequest,
  UserRef,
} from '../types';
import type { ApiProblem } from '@/lib/api-client';

const OPTIONAL = common.formField.optionalIndicator;

export interface ControlFormProps {
  mode: 'create' | 'edit';
  control?: ControlDetail;
  /** The `ETag` last read for `control`. Required when `mode === 'edit'`. */
  etag?: string;
  onSaved: (result: { control: ControlDetail; etag: string }) => void;
  /**
   * Overrides the "Cancelar" button's default `navigate.back()` (real
   * browser history navigation). Optional — omitted, this form behaves
   * exactly as it always has (`/controls/new`, the register's own create
   * flow). `ControlEditPanel` (021-control-detail-experience, Fase C/D)
   * passes its own overlay-close here: `navigate.back()` is correct when
   * this form IS the page (a real navigation got you here, so "cancel"
   * means "leave"), but wrong inside an overlay `Sheet`, which is not a
   * navigation at all — the coordinator measured this directly (F-79,
   * `docs/deferred-findings.md`): "Cancelar" navigated the browser back to
   * `/controls` instead of closing the panel, unlike the Sheet's own `X`
   * and `Escape`, both of which correctly stay on `/controls/{id}`. Mirrors
   * `ActionEditForm`'s own `onCancel: () => void` contract exactly — not
   * invented here, aligning the one sibling that had not yet needed it.
   */
  onCancel?: () => void;
}

interface ConflictState {
  currentVersion?: number;
  currentStatus?: string;
  modifiedAt?: string;
  modifiedBy?: { id: string; fullName: string };
}

function defaultValuesFor(control: ControlDetail | undefined): ControlFormValues {
  if (!control) {
    return {
      name: '',
      description: '',
      orgUnitId: '',
      ownerUserId: NONE_SELECT_VALUE,
      nature: NONE_SELECT_VALUE,
      type: NONE_SELECT_VALUE,
      frequency: NONE_SELECT_VALUE,
    };
  }
  return {
    name: control.name,
    description: control.description,
    // A control minted before this phase may carry no organizational unit
    // at all (FR-003, US1 AS5) — falls back to unset rather than crashing
    // or inventing one; `orgUnitId` is still required to SAVE the edit
    // (schema validation), exactly as it is for a brand-new control.
    orgUnitId: control.orgUnit?.id ?? '',
    ownerUserId: control.owner?.id ?? NONE_SELECT_VALUE,
    nature: control.nature ?? NONE_SELECT_VALUE,
    type: control.type ?? NONE_SELECT_VALUE,
    frequency: control.frequency ?? NONE_SELECT_VALUE,
  };
}

function buildCreateBody(values: ControlFormValues): CreateControlRequest {
  return {
    name: values.name,
    description: values.description,
    orgUnitId: values.orgUnitId,
    ownerUserId: toNullable(values.ownerUserId),
    nature: toNullable(values.nature) as ControlNature | null,
    type: toNullable(values.type) as ControlType | null,
    frequency: toNullable(values.frequency) as ControlFrequency | null,
  };
}

function buildUpdateBody(values: ControlFormValues): UpdateControlRequest {
  return {
    name: values.name,
    description: values.description,
    orgUnitId: values.orgUnitId,
    ownerUserId: toNullable(values.ownerUserId),
    nature: toNullable(values.nature) as ControlNature | null,
    type: toNullable(values.type) as ControlType | null,
    frequency: toNullable(values.frequency) as ControlFrequency | null,
  };
}

export function ControlForm({
  mode,
  control,
  etag,
  onSaved,
  onCancel,
}: ControlFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const [orgUnits, setOrgUnits] = useState<OrgUnitNode[] | null>(null);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataReloadToken, setReferenceDataReloadToken] = useState(0);

  // S-10 — the owner picker now searches the directory server-side
  // (`UserPicker`) instead of holding the ASSIGNMENT listing's full,
  // bounded page in `assignableUsers`. `owner` tracks the picker's own
  // current value (label included); `assignableUsersEmpty` is still
  // resolved eagerly per org unit (a single unsearched first page) purely
  // to tell "nobody is assignable here" apart from "nobody has been typed
  // yet" for the `assignablePickerState`/`ownerDescription` UX below.
  const [owner, setOwner] = useState<UserRef | undefined>(control?.owner ?? undefined);
  const [assignableUsersEmpty, setAssignableUsersEmpty] = useState(false);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [assignableUsersError, setAssignableUsersError] = useState(false);
  const [assignableUsersReloadToken, setAssignableUsersReloadToken] = useState(0);
  const [ownerClearedNotice, setOwnerClearedNotice] = useState(false);
  const previousOrgUnitIdRef = useRef<string | null>(null);

  const form = useForm<ControlFormValues>({
    resolver: zodResolver(controlFormSchema),
    defaultValues: defaultValuesFor(control),
  });

  const selectedOrgUnitId = useWatch({ control: form.control, name: 'orgUnitId' });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const units = await controlsApi.listOrgUnits();
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

  /** Mirrors `RiskForm`'s own assignment-listing effect — see that component's doc comment for the full reasoning. */
  useEffect(() => {
    let cancelled = false;
    const orgUnitId = selectedOrgUnitId || null;
    const previousOrgUnitId = previousOrgUnitIdRef.current;
    const isChange = previousOrgUnitId !== null && previousOrgUnitId !== orgUnitId;
    previousOrgUnitIdRef.current = orgUnitId;

    if (!orgUnitId) {
      return;
    }

    async function run(): Promise<void> {
      if (isChange) {
        setOwnerClearedNotice(false);
      }
      setLoadingAssignableUsers(true);
      setAssignableUsersError(false);

      try {
        const firstPage = await controlsApi.searchUsers('', orgUnitId!);
        if (cancelled) return;
        setAssignableUsersEmpty(firstPage.data.length === 0);

        // Re-validate the CURRENTLY selected owner against the NEW unit's
        // assignment line, only on an actual change (never on first mount,
        // which already trusts `control.owner` as given). `owner` is
        // usually already in `firstPage` (a small org has few assignable
        // users); when it is not, one targeted search by their own exact
        // name (not a full-list download) settles it before clearing —
        // never a false "cleared" for someone merely ranked past the first
        // page.
        if (isChange && owner) {
          const stillAssignable =
            firstPage.data.some((user) => user.id === owner.id) ||
            (await controlsApi.searchUsers(owner.fullName, orgUnitId!)).data.some(
              (user) => user.id === owner.id,
            );
          if (cancelled) return;
          if (!stillAssignable) {
            setOwner(undefined);
            form.setValue('ownerUserId', NONE_SELECT_VALUE, {
              shouldValidate: true,
              shouldDirty: true,
            });
            setOwnerClearedNotice(true);
          }
        }
      } catch {
        if (cancelled) return;
        setAssignableUsersError(true);
      } finally {
        if (!cancelled) {
          setLoadingAssignableUsers(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgUnitId, assignableUsersReloadToken]);

  function handleSubmitError(error: unknown): void {
    if (error instanceof ApiError) {
      const problem: ApiProblem = error.problem;
      if (problem.status === 409) {
        setConflict({
          currentVersion: problem.currentVersion,
          currentStatus: problem.currentStatus,
          modifiedAt: problem.modifiedAt,
          modifiedBy: problem.modifiedBy,
        });
        return;
      }
      if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
        for (const fieldError of problem.errors) {
          if (fieldError.field && fieldError.field in form.getValues()) {
            form.setError(fieldError.field as keyof ControlFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(controls.form.fixHighlightedFields);
        return;
      }
    }
    setFormError(controls.form.genericError);
  }

  async function onSubmit(values: ControlFormValues): Promise<void> {
    setFormError(null);
    setConflict(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await controlsApi.createControl(buildCreateBody(values));
        feedback.success(controls.form.createSuccess);
        onSaved(result);
        navigate(`/controls/${result.control.id}`);
        return;
      }

      const result = await controlsApi.updateControl(control!.id, buildUpdateBody(values), etag!);
      feedback.success(controls.form.updateSuccess);
      onSaved(result);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAnyway(): Promise<void> {
    if (!conflict?.currentVersion || !control) {
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const values = form.getValues();
      const ifMatch = `"${conflict.currentVersion}"`;
      const result = await controlsApi.updateControl(control.id, buildUpdateBody(values), ifMatch);
      setConflict(null);
      feedback.success(controls.form.updateSuccess);
      onSaved(result);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || loadingReferenceData;

  const orgUnitSelected = Boolean(selectedOrgUnitId);
  const assignablePickerState: 'no-unit' | 'loading' | 'error' | 'empty' | 'ready' =
    !orgUnitSelected
      ? 'no-unit'
      : assignableUsersError
        ? 'error'
        : loadingAssignableUsers
          ? 'loading'
          : assignableUsersEmpty
            ? 'empty'
            : 'ready';
  const assignablePickerDisabled = disabled || assignablePickerState === 'no-unit';
  const ownerDescription =
    assignablePickerState === 'no-unit'
      ? controls.form.fields.owner.selectOrgUnitFirst
      : assignablePickerState === 'loading'
        ? controls.form.fields.owner.loading
        : assignablePickerState === 'empty'
          ? controls.form.fields.owner.empty
          : controls.form.fields.owner.description;
  const retryAssignableUsers = (): void => setAssignableUsersReloadToken((token) => token + 1);

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

      {conflict ? (
        <Alert variant="destructive">
          <AlertTitle>{controls.form.conflict.title}</AlertTitle>
          <AlertDescription>
            <p>{controls.form.conflict.description}</p>
            {conflict.modifiedBy ? (
              <p>{controls.form.conflict.modifiedBy(conflict.modifiedBy.fullName)}</p>
            ) : null}
            {conflict.modifiedAt ? (
              <p>
                {controls.form.conflict.modifiedAt(new Date(conflict.modifiedAt).toLocaleString())}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {control ? (
                <Button asChild variant="outline" size="sm" type="button">
                  <a href={`/controls/${control.id}`} target="_blank" rel="noopener noreferrer">
                    {controls.form.conflict.reloadAction}
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
                {controls.form.conflict.retryAction}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => setConflict(null)}
              >
                {controls.form.conflict.dismissAction}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {referenceDataError ? (
        <ErrorState
          message={controls.form.referenceDataError}
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
        title={controls.form.sections.identification.title}
        description={controls.form.sections.identification.description}
      >
        <FormField
          label={controls.form.fields.name.label}
          required
          error={form.formState.errors.name?.message}
        >
          {(field) => <Input {...field} {...form.register('name')} disabled={disabled} />}
        </FormField>

        <FormField
          label={controls.form.fields.description.label}
          required
          error={form.formState.errors.description?.message}
        >
          {(field) => (
            <Textarea {...field} {...form.register('description')} rows={4} disabled={disabled} />
          )}
        </FormField>
      </FormSection>

      <FormSection
        title={controls.form.sections.classification.title}
        description={controls.form.sections.classification.description}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            control={form.control}
            name="nature"
            render={({ field }) => (
              <FormField label={controls.form.fields.nature.label} optionalIndicator={OPTIONAL}>
                {(a11y) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger id={a11y.id} className="w-full">
                      <SelectValue placeholder={controls.form.fields.nature.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>
                        {controls.form.fields.nature.placeholder}
                      </SelectItem>
                      {(Object.keys(controls.natureLabels) as ControlNature[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {controls.natureLabels[value]}
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
            name="type"
            render={({ field }) => (
              <FormField label={controls.form.fields.type.label} optionalIndicator={OPTIONAL}>
                {(a11y) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger id={a11y.id} className="w-full">
                      <SelectValue placeholder={controls.form.fields.type.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>
                        {controls.form.fields.type.placeholder}
                      </SelectItem>
                      {(Object.keys(controls.typeLabels) as ControlType[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {controls.typeLabels[value]}
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
            name="frequency"
            render={({ field }) => (
              <FormField label={controls.form.fields.frequency.label} optionalIndicator={OPTIONAL}>
                {(a11y) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger id={a11y.id} className="w-full">
                      <SelectValue placeholder={controls.form.fields.frequency.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>
                        {controls.form.fields.frequency.placeholder}
                      </SelectItem>
                      {(Object.keys(controls.frequencyLabels) as ControlFrequency[]).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {controls.frequencyLabels[value]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />
        </div>
      </FormSection>

      <FormSection
        title={controls.form.sections.ownership.title}
        description={controls.form.sections.ownership.description}
      >
        <Controller
          control={form.control}
          name="orgUnitId"
          render={({ field }) => (
            <FormField
              label={controls.form.fields.orgUnit.label}
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
                    <SelectValue placeholder={controls.form.fields.orgUnit.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgUnits?.map((unit) => (
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
            name="ownerUserId"
            render={({ field }) => (
              <FormField
                label={controls.form.fields.owner.label}
                optionalIndicator={OPTIONAL}
                description={assignablePickerState === 'error' ? undefined : ownerDescription}
              >
                {() => (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <UserPicker
                        value={owner}
                        onChange={(user) => {
                          setOwner(user);
                          field.onChange(user.id);
                          setOwnerClearedNotice(false);
                        }}
                        onSearch={(q) => controlsApi.searchUsers(q, selectedOrgUnitId || undefined)}
                        disabled={assignablePickerDisabled}
                        labels={{
                          placeholder: controls.form.fields.owner.placeholder,
                          triggerAriaLabel: controls.form.fields.owner.label,
                        }}
                      />
                    </div>
                    {owner ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={assignablePickerDisabled}
                        onClick={() => {
                          setOwner(undefined);
                          field.onChange(NONE_SELECT_VALUE);
                          setOwnerClearedNotice(false);
                        }}
                      >
                        {controls.form.fields.owner.clearAction}
                      </Button>
                    ) : null}
                  </div>
                )}
              </FormField>
            )}
          />
          {assignablePickerState === 'error' ? (
            <p
              role="alert"
              className="flex flex-wrap items-center gap-2 text-sm font-medium text-status-danger-fg"
            >
              <span>{controls.form.fields.owner.loadError}</span>
              <Button type="button" variant="outline" size="sm" onClick={retryAssignableUsers}>
                {common.actions.retry}
              </Button>
            </p>
          ) : null}
          {ownerClearedNotice ? (
            <p role="status" className="text-sm font-medium text-status-warning-fg">
              {controls.form.fields.owner.clearedNotice}
            </p>
          ) : null}
        </div>
      </FormSection>

      <p className="text-sm text-muted-foreground">{controls.form.unsavedNote}</p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? controls.form.actions.creating
              : controls.form.actions.saveAndCreate
            : submitting
              ? controls.form.actions.saving
              : controls.form.actions.save}
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
