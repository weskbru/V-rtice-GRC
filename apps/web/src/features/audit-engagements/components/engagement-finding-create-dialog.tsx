'use client';

/**
 * PharosGRC — "Registrar achado" dialog, from an audit engagement (T077,
 * 005-audit-findings, US2, FR-007/FR-008).
 *
 * `POST /audits/{auditId}/findings` — same fields as `FindingCreateDialog`
 * (Phase 1, `features/findings/components/finding-create-dialog.tsx`), minus
 * `orgUnitId`: never accepted here, always derived server-side from the
 * engagement's own organizational unit (`findingsFromEngagement.form
 * .createDescription` says so explicitly, rather than rendering a
 * disabled/pre-filled field that would misleadingly suggest it is part of
 * this request). Reuses `createFindingFormSchema` unchanged —
 * `CreateFindingFromEngagementRequest`'s own fields are already exactly
 * that schema's fields (`lib/validation/findings.ts`'s own shape, no
 * `orgUnitId` there either) — and `findings.ts`'s own field labels/option
 * lists, per this task's own instruction to reuse an existing catalog
 * entry rather than declare a second copy.
 *
 * `Finding` is core-GRC (`grc/finding`, CLAUDE.md §1/§19.6), not a business
 * module — so this business module (Auditoria) depending on it here is the
 * expected direction, not a business-module-to-business-module dependency
 * CLAUDE.md §4/§19 rules out.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { UserPicker } from '@/components/directory/user-picker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { findingsApi } from '@/features/findings/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { findings as findingsMessages } from '@/lib/messages/findings';
import { createFindingFormSchema, type CreateFindingFormValues } from '@/lib/validation/findings';

import { auditEngagementsApi } from '../api';

import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingSummary,
} from '../types';
import type { UserRef } from '@/features/risks/types';

const { findingsFromEngagement } = auditEngagements;
const OPTIONAL = common.formField.optionalIndicator;

const CATEGORIES: readonly FindingCategory[] = [
  'NONCONFORMITY',
  'CONTROL_DEFICIENCY',
  'OBSERVATION',
  'IMPROVEMENT_OPPORTUNITY',
];
const ORIGINS: readonly FindingOrigin[] = [
  'INTERNAL_ASSESSMENT',
  'CONTROL_TESTING',
  'MANAGEMENT_REVIEW',
];
const SEVERITIES: readonly FindingSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITIES: readonly FindingPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function todayDateOnly(): string {
  // Local calendar date, never `Date#toISOString()`'s UTC date: in any
  // timezone behind UTC, an evening `toISOString().slice(0, 10)` returns
  // TOMORROW, so this field defaulted to a date that had not happened yet.
  // Found on the rendered screen (CLAUDE.md §18.1) defaulting to 09/09
  // on 08/09. Same rule as `features/*/date.ts`'s own `todayDateOnly`.
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface EngagementFindingCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditId: string;
  defaultOwnerUserId: string;
  onCreated: (finding: FindingSummary) => void;
}

export function EngagementFindingCreateDialog({
  open,
  onOpenChange,
  auditId,
  defaultOwnerUserId,
  onCreated,
}: EngagementFindingCreateDialogProps): React.JSX.Element {
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // S-10 — the owner picker now searches the directory server-side
  // (`UserPicker`) instead of a preloaded, bounded list. Every call site of
  // this dialog passes the CURRENT USER's own id as `defaultOwnerUserId`
  // (self-assign default) — so that label is already known from the
  // session itself, with no fetch needed for the common case.
  const defaultOwner: UserRef | undefined =
    currentUser.id === defaultOwnerUserId
      ? { id: currentUser.id, fullName: currentUser.fullName, email: currentUser.email }
      : undefined;
  const [owner, setOwner] = useState<UserRef | undefined>(defaultOwner);

  const form = useForm<CreateFindingFormValues>({
    resolver: zodResolver(createFindingFormSchema),
    defaultValues: {
      title: '',
      description: '',
      recommendation: '',
      category: '',
      origin: '',
      severity: '',
      priority: '',
      ownerUserId: defaultOwnerUserId,
      identifiedOn: todayDateOnly(),
    },
  });

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      form.reset();
      // The picker shows `owner`, not the form value: reset both, or a reopened
      // dialog would display the previous pick while submitting the default.
      setOwner(defaultOwner);
      setFormError(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CreateFindingFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await auditEngagementsApi.createEngagementFinding(auditId, {
        title: values.title,
        description: values.description,
        recommendation: values.recommendation || undefined,
        category: values.category as FindingCategory,
        origin: values.origin as FindingOrigin,
        severity: values.severity as FindingSeverity,
        priority: values.priority as FindingPriority,
        ownerUserId: values.ownerUserId,
        identifiedOn: values.identifiedOn,
      });
      handleOpenChange(false);
      onCreated(created);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.problem.status === 422 &&
        error.problem.errors?.length
      ) {
        for (const fieldError of error.problem.errors) {
          if (fieldError.field && fieldError.field in form.getValues()) {
            form.setError(fieldError.field as keyof CreateFindingFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(findingsFromEngagement.form.fixHighlightedFields);
      } else if (error instanceof ApiError && error.problem.status === 422) {
        // Not-`IN_PROGRESS` refusal (FR-007) — named specifically rather
        // than falling through to the generic error, mirroring the
        // proactive notice this same rule already gets before the attempt
        // (`EngagementFindingsSection`'s own `notInProgressNotice`).
        setFormError(error.problem.detail ?? findingsFromEngagement.notInProgressError);
      } else if (error instanceof ApiError && error.problem.detail) {
        setFormError(error.problem.detail);
      } else {
        setFormError(findingsFromEngagement.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{findingsFromEngagement.form.createTitle}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            void form.handleSubmit(onSubmit)(event);
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-muted-foreground">
            {findingsFromEngagement.form.createDescription}
          </p>

          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            >
              {formError}
            </p>
          ) : null}

          <FormField
            label={findingsMessages.form.fields.title.label}
            required
            error={form.formState.errors.title?.message}
          >
            {(field) => <Input {...field} {...form.register('title')} disabled={submitting} />}
          </FormField>

          <FormField
            label={findingsMessages.form.fields.description.label}
            required
            error={form.formState.errors.description?.message}
          >
            {(field) => (
              <Textarea
                {...field}
                {...form.register('description')}
                disabled={submitting}
                rows={3}
              />
            )}
          </FormField>

          <FormField
            label={findingsMessages.form.fields.recommendation.label}
            optionalIndicator={OPTIONAL}
          >
            {(field) => (
              <Textarea
                {...field}
                {...form.register('recommendation')}
                disabled={submitting}
                rows={2}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormField
                  label={findingsMessages.form.fields.category.label}
                  required
                  error={form.formState.errors.category?.message}
                >
                  {(a11y) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting}
                    >
                      <SelectTrigger id={a11y.id} className="w-full">
                        <SelectValue
                          placeholder={findingsMessages.form.fields.category.placeholder}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {findingsMessages.categoryLabels[category]}
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
              name="origin"
              render={({ field }) => (
                <FormField
                  label={findingsMessages.form.fields.origin.label}
                  required
                  error={form.formState.errors.origin?.message}
                >
                  {(a11y) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting}
                    >
                      <SelectTrigger id={a11y.id} className="w-full">
                        <SelectValue
                          placeholder={findingsMessages.form.fields.origin.placeholder}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {ORIGINS.map((origin) => (
                          <SelectItem key={origin} value={origin}>
                            {findingsMessages.originLabels[origin]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormField
                  label={findingsMessages.form.fields.severity.label}
                  required
                  error={form.formState.errors.severity?.message}
                >
                  {(a11y) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting}
                    >
                      <SelectTrigger id={a11y.id} className="w-full">
                        <SelectValue
                          placeholder={findingsMessages.form.fields.severity.placeholder}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((severity) => (
                          <SelectItem key={severity} value={severity}>
                            {findingsMessages.severityLabels[severity]}
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
              name="priority"
              render={({ field }) => (
                <FormField
                  label={findingsMessages.form.fields.priority.label}
                  required
                  error={form.formState.errors.priority?.message}
                >
                  {(a11y) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting}
                    >
                      <SelectTrigger id={a11y.id} className="w-full">
                        <SelectValue
                          placeholder={findingsMessages.form.fields.priority.placeholder}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {findingsMessages.priorityLabels[priority]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="ownerUserId"
            render={({ field }) => (
              <FormField
                label={findingsMessages.form.fields.ownerUserId.label}
                required
                error={form.formState.errors.ownerUserId?.message}
              >
                {() => (
                  <UserPicker
                    value={owner}
                    onChange={(user) => {
                      setOwner(user);
                      field.onChange(user.id);
                    }}
                    onSearch={(q) => findingsApi.searchUsers(q)}
                    disabled={submitting}
                    labels={{
                      placeholder: findingsMessages.form.fields.ownerUserId.label,
                      triggerAriaLabel: findingsMessages.form.fields.ownerUserId.label,
                    }}
                  />
                )}
              </FormField>
            )}
          />

          <FormField
            label={findingsMessages.form.fields.identifiedOn.label}
            required
            error={form.formState.errors.identifiedOn?.message}
          >
            {(field) => (
              <Input
                type="date"
                {...field}
                {...form.register('identifiedOn')}
                disabled={submitting}
              />
            )}
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              {findingsMessages.form.cancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {submitting
                ? findingsFromEngagement.form.submitting
                : findingsFromEngagement.form.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
