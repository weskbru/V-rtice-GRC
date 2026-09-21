'use client';

/**
 * PharosGRC — risk create/edit form (T095, T099, FR-053 to FR-060).
 *
 * ## Conflict handling (T099, FR-103, ADR-013)
 *
 * Editing a risk requires the `version` last read, echoed as `If-Match`
 * (ADR-013). When another user saves first, the server answers `409` with
 * the risk's current `version`/`status`/last modifier rather than silently
 * overwriting anything. The easy-and-wrong response to that would be to
 * discard the form and reload the record — that throws away everything the
 * user just typed. Instead, on a `409` this component:
 *
 *   1. Leaves every field exactly as the user left it. Nothing is reset,
 *      nothing is refetched into the form — `form.getValues()` after a 409
 *      is identical to `form.getValues()` right before the failed submit.
 *   2. Shows a banner explaining *why* the save did not go through — the
 *      record changed underneath them — and, when the server supplied them,
 *      who changed it and when, so the user can judge whether to look at it
 *      before proceeding.
 *   3. Offers three explicit next actions, none of which touches the form's
 *      values on the user's behalf:
 *      - "Ver versão atual em nova aba" opens `/risks/{id}` in a new tab so
 *        the user can review what changed side-by-side, without losing this
 *        editing session.
 *      - "Salvar mesmo assim com meus dados" re-submits the *exact* values
 *        still in the form, now against the current version the 409 body
 *        supplied. This is a deliberate, informed overwrite the user
 *        explicitly chose after being shown the conflict — not silent
 *        last-write-wins (FR-103 forbids the silent kind, not an informed
 *        one).
 *      - "Continuar editando" simply dismisses the banner so the user can
 *        adjust fields first (e.g. after reviewing the other tab) before
 *        retrying a normal save.
 *
 * A second conflict while retrying re-enters this same state rather than
 * ever falling back to overwriting blindly.
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
import { risks } from '@/lib/messages/risks';
import {
  NONE_SELECT_VALUE,
  riskFormSchema,
  toNullable,
  type RiskFormValues,
} from '@/lib/validation/risk';

import { risksApi } from '../api';
import { todayDateOnly } from '../date';

import type {
  CreateRiskRequest,
  OrgUnitNode,
  ReferenceDataItem,
  RiskDetail,
  UpdateRiskRequest,
  UserRef,
} from '../types';
import type { ApiProblem } from '@/lib/api-client';

/** The platform-wide required/optional convention (CLAUDE.md §18, `common.formField`'s own doc comment) — every non-required `FormField` in this form shows it. */
const OPTIONAL = common.formField.optionalIndicator;

export interface RiskFormProps {
  mode: 'create' | 'edit';
  /** Required, and used as the initial values, when `mode === 'edit'`. */
  risk?: RiskDetail;
  /** The `ETag` last read for `risk` (ADR-013). Required when `mode === 'edit'`. */
  etag?: string;
  /** Called after a successful create or update with the fresh record and its new `ETag`. */
  onSaved: (result: { risk: RiskDetail; etag: string }) => void;
}

interface ReferenceData {
  categories: ReferenceDataItem[];
  types: ReferenceDataItem[];
  origins: ReferenceDataItem[];
  orgUnits: OrgUnitNode[];
}

interface ConflictState {
  currentVersion?: number;
  currentStatus?: string;
  modifiedAt?: string;
  modifiedBy?: { id: string; fullName: string };
}

function defaultValuesFor(risk: RiskDetail | undefined): RiskFormValues {
  if (!risk) {
    return {
      title: '',
      description: '',
      categoryId: NONE_SELECT_VALUE,
      typeId: NONE_SELECT_VALUE,
      originId: NONE_SELECT_VALUE,
      orgUnitId: '',
      ownerUserId: '',
      responsibleUserId: NONE_SELECT_VALUE,
      identifiedOn: todayDateOnly(),
      nextReviewOn: '',
    };
  }
  return {
    title: risk.title,
    description: risk.description,
    categoryId: risk.category?.id ?? NONE_SELECT_VALUE,
    typeId: risk.type?.id ?? NONE_SELECT_VALUE,
    originId: risk.origin?.id ?? NONE_SELECT_VALUE,
    orgUnitId: risk.orgUnit.id,
    ownerUserId: risk.owner.id,
    responsibleUserId: risk.responsible?.id ?? NONE_SELECT_VALUE,
    identifiedOn: risk.identifiedOn,
    nextReviewOn: risk.nextReviewOn ?? '',
  };
}

function buildCreateBody(values: RiskFormValues): CreateRiskRequest {
  return {
    title: values.title,
    description: values.description,
    categoryId: toNullable(values.categoryId),
    typeId: toNullable(values.typeId),
    originId: toNullable(values.originId),
    orgUnitId: values.orgUnitId,
    ownerUserId: values.ownerUserId,
    responsibleUserId: toNullable(values.responsibleUserId),
    identifiedOn: values.identifiedOn,
    nextReviewOn: toNullable(values.nextReviewOn),
  };
}

function buildUpdateBody(values: RiskFormValues): UpdateRiskRequest {
  return {
    title: values.title,
    description: values.description,
    categoryId: toNullable(values.categoryId),
    typeId: toNullable(values.typeId),
    originId: toNullable(values.originId),
    orgUnitId: values.orgUnitId,
    ownerUserId: values.ownerUserId,
    responsibleUserId: toNullable(values.responsibleUserId),
    identifiedOn: values.identifiedOn,
    nextReviewOn: toNullable(values.nextReviewOn),
  };
}

export function RiskForm({ mode, risk, etag, onSaved }: RiskFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [referenceDataError, setReferenceDataError] = useState(false);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [referenceDataReloadToken, setReferenceDataReloadToken] = useState(0);

  // ---------------------------------------------------------------------
  // Owner/responsible pickers — the ASSIGNMENT listing for whichever
  // organizational unit is currently selected in this form, never the
  // browse listing `risksApi.searchUsers(q)` (no `assignableForOrgUnitId`)
  // returns for the CALLER's own scope. See `risksApi.searchUsers`'s doc
  // comment and `risks.form.fields.owner`'s own doc comment (message
  // catalogue) for why the two must never be conflated for a required field.
  // ---------------------------------------------------------------------
  // S-10 — both pickers now search the directory server-side (`UserPicker`)
  // instead of holding the ASSIGNMENT listing's full, bounded page in
  // `assignableUsers`. `owner`/`responsible` track each picker's own
  // current value (label included); `assignableUsersEmpty` is still
  // resolved eagerly per org unit (a single unsearched first page) purely
  // to tell "nobody is assignable here" apart from "nobody has been typed
  // yet" for `assignablePickerState`/the description text below.
  const [owner, setOwner] = useState<UserRef | undefined>(risk?.owner);
  const [responsible, setResponsible] = useState<UserRef | undefined>(
    risk?.responsible ?? undefined,
  );
  const [assignableUsersEmpty, setAssignableUsersEmpty] = useState(false);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [assignableUsersError, setAssignableUsersError] = useState(false);
  const [assignableUsersReloadToken, setAssignableUsersReloadToken] = useState(0);
  const [ownerClearedNotice, setOwnerClearedNotice] = useState(false);
  const [responsibleClearedNotice, setResponsibleClearedNotice] = useState(false);
  /** `null` until the first organizational unit has ever been selected — distinguishes "nothing chosen yet" (no clearing) from "the unit actually changed" (may need to clear a now-invalid owner/responsible), see the effect below. */
  const previousOrgUnitIdRef = useRef<string | null>(null);

  const form = useForm<RiskFormValues>({
    resolver: zodResolver(riskFormSchema),
    defaultValues: defaultValuesFor(risk),
  });

  const selectedOrgUnitId = useWatch({ control: form.control, name: 'orgUnitId' });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingReferenceData(true);
      setReferenceDataError(false);
      try {
        const [categories, types, origins, orgUnits] = await Promise.all([
          risksApi.listCategories(),
          risksApi.listTypes(),
          risksApi.listOrigins(),
          risksApi.listOrgUnits(),
        ]);
        if (!cancelled) {
          setReferenceData({ categories, types, origins, orgUnits });
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

  /**
   * Refetches the assignment listing every time the form's own
   * `orgUnitId` changes — never once at mount. When this is an actual
   * CHANGE (not the form's very first render with its initial org unit),
   * an already-selected owner/responsible that the new set no longer
   * contains is cleared rather than left to be silently rejected by the
   * server on submit, and that clearing is surfaced via
   * `ownerClearedNotice`/`responsibleClearedNotice` — never done quietly.
   */
  useEffect(() => {
    let cancelled = false;
    const orgUnitId = selectedOrgUnitId || null;
    const previousOrgUnitId = previousOrgUnitIdRef.current;
    const isChange = previousOrgUnitId !== null && previousOrgUnitId !== orgUnitId;
    previousOrgUnitIdRef.current = orgUnitId;

    if (!orgUnitId) {
      // Nothing to fetch yet. No setState here: `assignablePickerState`
      // (below, render time) already treats "no unit selected" as its own
      // `'no-unit'` case ahead of `assignableUsers`/`loadingAssignableUsers`/
      // `assignableUsersError`, so a stale value in any of those from a
      // previous unit can never leak into what the picker shows.
      return;
    }

    // Nested and invoked via `void run()` — same shape as the reference-data
    // effect above — so the "start loading" `setState` calls below run
    // inside a called function rather than directly in the effect body
    // (`react-hooks/set-state-in-effect`: a bare synchronous `setState` at
    // the top of an effect risks a cascading render; one that kicks off an
    // async fetch and reports its outcome does not).
    // Re-validates one currently selected user against the org unit's
    // assignment line — first against the already-fetched first page (the
    // common case for a small org), falling back to one targeted search by
    // their own exact name (never a full-list download) before concluding
    // they are no longer assignable. Mirrors `ControlForm`'s identical fix.
    async function stillAssignable(user: UserRef, firstPage: readonly UserRef[]): Promise<boolean> {
      if (firstPage.some((candidate) => candidate.id === user.id)) return true;
      const result = await risksApi.searchUsers(user.fullName, orgUnitId!);
      return result.data.some((candidate) => candidate.id === user.id);
    }

    async function run(): Promise<void> {
      if (isChange) {
        setOwnerClearedNotice(false);
        setResponsibleClearedNotice(false);
      }
      setLoadingAssignableUsers(true);
      setAssignableUsersError(false);

      try {
        const firstPage = await risksApi.searchUsers('', orgUnitId!);
        if (cancelled) return;
        setAssignableUsersEmpty(firstPage.data.length === 0);

        if (isChange && owner) {
          if (!(await stillAssignable(owner, firstPage.data))) {
            if (cancelled) return;
            setOwner(undefined);
            form.setValue('ownerUserId', '', { shouldValidate: true, shouldDirty: true });
            setOwnerClearedNotice(true);
          }
        }
        if (isChange && responsible) {
          if (!(await stillAssignable(responsible, firstPage.data))) {
            if (cancelled) return;
            setResponsible(undefined);
            form.setValue('responsibleUserId', NONE_SELECT_VALUE, {
              shouldValidate: true,
              shouldDirty: true,
            });
            setResponsibleClearedNotice(true);
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
    // `form` (react-hook-form's returned object) is stable across renders;
    // only the selected unit and an explicit retry should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgUnitId, assignableUsersReloadToken]);

  /** Shared error handling for both the normal submit path and the conflict "save anyway" retry. */
  function handleSubmitError(error: unknown): void {
    if (error instanceof ApiError) {
      const problem: ApiProblem = error.problem;
      if (problem.status === 409) {
        // T099: the record changed underneath the user. Surface it; never
        // reset the form, never auto-reload.
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
            form.setError(fieldError.field as keyof RiskFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(risks.form.fixHighlightedFields);
        return;
      }
    }
    setFormError(risks.form.genericError);
  }

  async function onSubmit(values: RiskFormValues): Promise<void> {
    setFormError(null);
    setConflict(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const result = await risksApi.createRisk(buildCreateBody(values));
        feedback.success(risks.form.createSuccess);
        onSaved(result);
        navigate(`/risks/${result.risk.id}`);
        return;
      }

      // mode === 'edit' — RiskFormProps requires `risk`/`etag` in this mode.
      // `etag` is read fresh from props (not duplicated into local state) so
      // this always sends the caller's most current version — including one
      // that advanced for a reason outside this form, e.g. the detail page's
      // Causes and Consequences section saving concurrently.
      const result = await risksApi.updateRisk(risk!.id, buildUpdateBody(values), etag!);
      feedback.success(risks.form.updateSuccess);
      onSaved(result);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAnyway(): Promise<void> {
    if (!conflict?.currentVersion || !risk) {
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const values = form.getValues();
      const ifMatch = `"${conflict.currentVersion}"`;
      const result = await risksApi.updateRisk(risk.id, buildUpdateBody(values), ifMatch);
      setConflict(null);
      feedback.success(risks.form.updateSuccess);
      onSaved(result);
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || loadingReferenceData;

  // -----------------------------------------------------------------------
  // Owner/responsible picker state — see the assignment-listing effect above
  // and `risks.form.fields.owner`'s own doc comment (message catalogue) for
  // why this is derived from `selectedOrgUnitId`/`assignableUsers` rather
  // than from `referenceData`. Owner and responsible read the SAME
  // underlying fetch (one org unit has exactly one assignment set), so both
  // pickers are always in the same one of these four states at once.
  // -----------------------------------------------------------------------
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
  // Disabled only when there is genuinely nothing to pick from yet — no
  // organizational unit chosen at all. `loading` and `error` leave the
  // control itself enabled (its `SelectContent` is simply empty in either
  // case) because BOTH are communicated explicitly beside it — the
  // description text below the field for `loading`, and the dedicated
  // role="alert" line with a retry action for `error` — never by disabling
  // silently. Only `no-unit` has no data-driven state to show yet, so
  // disabling it is what keeps it from reading as an empty, broken picker.
  const assignablePickerDisabled = disabled || assignablePickerState === 'no-unit';
  const ownerDescription =
    assignablePickerState === 'no-unit'
      ? risks.form.fields.owner.selectOrgUnitFirst
      : assignablePickerState === 'loading'
        ? risks.form.fields.owner.loading
        : assignablePickerState === 'empty'
          ? risks.form.fields.owner.empty
          : risks.form.fields.owner.description;
  const responsibleDescription =
    assignablePickerState === 'no-unit'
      ? risks.form.fields.responsible.selectOrgUnitFirst
      : assignablePickerState === 'loading'
        ? risks.form.fields.responsible.loading
        : assignablePickerState === 'empty'
          ? risks.form.fields.responsible.empty
          : risks.form.fields.responsible.description;
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
          <AlertTitle>{risks.form.conflict.title}</AlertTitle>
          <AlertDescription>
            <p>{risks.form.conflict.description}</p>
            {conflict.modifiedBy ? (
              <p>{risks.form.conflict.modifiedBy(conflict.modifiedBy.fullName)}</p>
            ) : null}
            {conflict.modifiedAt ? (
              <p>
                {risks.form.conflict.modifiedAt(new Date(conflict.modifiedAt).toLocaleString())}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {risk ? (
                <Button asChild variant="outline" size="sm" type="button">
                  <a href={`/risks/${risk.id}`} target="_blank" rel="noopener noreferrer">
                    {risks.form.conflict.reloadAction}
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
                {risks.form.conflict.retryAction}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => setConflict(null)}
              >
                {risks.form.conflict.dismissAction}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {referenceDataError ? (
        <ErrorState
          message={risks.form.referenceDataError}
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
        title={risks.form.sections.identification.title}
        description={risks.form.sections.identification.description}
      >
        <FormField
          label={risks.form.fields.title.label}
          required
          error={form.formState.errors.title?.message}
        >
          {(field) => <Input {...field} {...form.register('title')} disabled={disabled} />}
        </FormField>

        <FormField
          label={risks.form.fields.description.label}
          required
          error={form.formState.errors.description?.message}
        >
          {(field) => (
            <Textarea {...field} {...form.register('description')} rows={4} disabled={disabled} />
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormField label={risks.form.fields.category.label} optionalIndicator={OPTIONAL}>
                {(a11y) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger
                      id={a11y.id}
                      className="w-full"
                      aria-describedby={a11y['aria-describedby']}
                    >
                      <SelectValue placeholder={risks.form.fields.category.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>
                        {risks.form.fields.category.placeholder}
                      </SelectItem>
                      {referenceData?.categories.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
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
            name="typeId"
            render={({ field }) => (
              <FormField label={risks.form.fields.type.label} optionalIndicator={OPTIONAL}>
                {(a11y) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger
                      id={a11y.id}
                      className="w-full"
                      aria-describedby={a11y['aria-describedby']}
                    >
                      <SelectValue placeholder={risks.form.fields.type.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>
                        {risks.form.fields.type.placeholder}
                      </SelectItem>
                      {referenceData?.types.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
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
            name="originId"
            render={({ field }) => (
              <FormField label={risks.form.fields.origin.label} optionalIndicator={OPTIONAL}>
                {(a11y) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger
                      id={a11y.id}
                      className="w-full"
                      aria-describedby={a11y['aria-describedby']}
                    >
                      <SelectValue placeholder={risks.form.fields.origin.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>
                        {risks.form.fields.origin.placeholder}
                      </SelectItem>
                      {referenceData?.origins.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />
        </div>
      </FormSection>

      <FormSection
        title={risks.form.sections.ownership.title}
        description={risks.form.sections.ownership.description}
      >
        <Controller
          control={form.control}
          name="orgUnitId"
          render={({ field }) => (
            <FormField
              label={risks.form.fields.orgUnit.label}
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
                    <SelectValue placeholder={risks.form.fields.orgUnit.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {referenceData?.orgUnits.map((unit) => (
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Controller
              control={form.control}
              name="ownerUserId"
              render={({ field }) => (
                <FormField
                  label={risks.form.fields.owner.label}
                  required
                  description={assignablePickerState === 'error' ? undefined : ownerDescription}
                  error={form.formState.errors.ownerUserId?.message}
                >
                  {() => (
                    <UserPicker
                      value={owner}
                      onChange={(user) => {
                        setOwner(user);
                        field.onChange(user.id);
                        setOwnerClearedNotice(false);
                      }}
                      onSearch={(q) => risksApi.searchUsers(q, selectedOrgUnitId || undefined)}
                      disabled={assignablePickerDisabled}
                      labels={{
                        placeholder: risks.form.fields.owner.placeholder,
                        triggerAriaLabel: risks.form.fields.owner.label,
                      }}
                    />
                  )}
                </FormField>
              )}
            />
            {assignablePickerState === 'error' ? (
              <p
                role="alert"
                className="flex flex-wrap items-center gap-2 text-sm font-medium text-status-danger-fg"
              >
                <span>{risks.form.fields.owner.loadError}</span>
                <Button type="button" variant="outline" size="sm" onClick={retryAssignableUsers}>
                  {common.actions.retry}
                </Button>
              </p>
            ) : null}
            {ownerClearedNotice ? (
              <p role="status" className="text-sm font-medium text-status-warning-fg">
                {risks.form.fields.owner.clearedNotice}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Controller
              control={form.control}
              name="responsibleUserId"
              render={({ field }) => (
                <FormField
                  label={risks.form.fields.responsible.label}
                  description={
                    assignablePickerState === 'error' ? undefined : responsibleDescription
                  }
                  optionalIndicator={OPTIONAL}
                >
                  {() => (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <UserPicker
                          value={responsible}
                          onChange={(user) => {
                            setResponsible(user);
                            field.onChange(user.id);
                            setResponsibleClearedNotice(false);
                          }}
                          onSearch={(q) => risksApi.searchUsers(q, selectedOrgUnitId || undefined)}
                          disabled={assignablePickerDisabled}
                          labels={{
                            placeholder: risks.form.fields.responsible.placeholder,
                            triggerAriaLabel: risks.form.fields.responsible.label,
                          }}
                        />
                      </div>
                      {responsible ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={assignablePickerDisabled}
                          onClick={() => {
                            setResponsible(undefined);
                            field.onChange(NONE_SELECT_VALUE);
                            setResponsibleClearedNotice(false);
                          }}
                        >
                          {risks.form.fields.responsible.clearAction}
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
                <span>{risks.form.fields.responsible.loadError}</span>
                <Button type="button" variant="outline" size="sm" onClick={retryAssignableUsers}>
                  {common.actions.retry}
                </Button>
              </p>
            ) : null}
            {responsibleClearedNotice ? (
              <p role="status" className="text-sm font-medium text-status-warning-fg">
                {risks.form.fields.responsible.clearedNotice}
              </p>
            ) : null}
          </div>
        </div>
      </FormSection>

      <FormSection
        title={risks.form.sections.dates.title}
        description={risks.form.sections.dates.description}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={risks.form.fields.identifiedOn.label} required>
            {(field) => (
              <Input
                type="date"
                {...field}
                {...form.register('identifiedOn')}
                disabled={disabled}
              />
            )}
          </FormField>

          <FormField label={risks.form.fields.nextReviewOn.label} optionalIndicator={OPTIONAL}>
            {(field) => (
              <Input
                type="date"
                {...field}
                {...form.register('nextReviewOn')}
                disabled={disabled}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      <p className="text-sm text-muted-foreground">{risks.form.unsavedNote}</p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {mode === 'create'
            ? submitting
              ? risks.form.actions.creating
              : risks.form.actions.saveAndCreate
            : submitting
              ? risks.form.actions.saving
              : risks.form.actions.save}
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
