'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { findings as findingsMessages } from '@/lib/messages/findings';
import { editFindingFormSchema, type EditFindingFormValues } from '@/lib/validation/findings';

import { findingsApi } from '../api';

import type { Finding, FindingCategory, FindingPriority, FindingSeverity } from '../types';
import type { UserRef } from '@/features/risks/types';

const OPTIONAL = common.formField.optionalIndicator;

const CATEGORIES: readonly FindingCategory[] = [
  'NONCONFORMITY',
  'CONTROL_DEFICIENCY',
  'OBSERVATION',
  'IMPROVEMENT_OPPORTUNITY',
];
const SEVERITIES: readonly FindingSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITIES: readonly FindingPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export interface FindingEditDialogProps {
  finding: Finding | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (finding: Finding) => void;
}

export function FindingEditDialog({
  finding,
  onOpenChange,
  onSaved,
}: FindingEditDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [owner, setOwner] = useState<UserRef | undefined>(finding?.owner);

  const form = useForm<EditFindingFormValues>({
    resolver: zodResolver(editFindingFormSchema),
    defaultValues: {
      title: '',
      description: '',
      recommendation: '',
      category: '',
      severity: '',
      priority: '',
      ownerUserId: '',
    },
  });

  useEffect(() => {
    function apply(target: NonNullable<typeof finding>): void {
      form.reset({
        title: target.title,
        description: target.description,
        recommendation: target.recommendation ?? '',
        category: target.category,
        severity: target.severity,
        priority: target.priority,
        ownerUserId: target.owner.id,
      });
      setOwner(target.owner);
    }
    if (finding) apply(finding);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseta quando muda a identidade do achado.
  }, [finding?.id]);

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) setFormError(null);
    onOpenChange(next);
  }

  async function onSubmit(values: EditFindingFormValues): Promise<void> {
    if (!finding) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const updated = await findingsApi.updateFinding(finding.id, {
        title: values.title,
        description: values.description,
        recommendation: values.recommendation || null,
        category: values.category as FindingCategory,
        severity: values.severity as FindingSeverity,
        priority: values.priority as FindingPriority,
        ownerUserId: values.ownerUserId,
      });
      handleOpenChange(false);
      onSaved(updated);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.problem.status === 422 &&
        error.problem.errors?.length
      ) {
        for (const fieldError of error.problem.errors) {
          if (fieldError.field && fieldError.field in form.getValues()) {
            form.setError(fieldError.field as keyof EditFindingFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(findingsMessages.form.fixHighlightedFields);
      } else if (error instanceof ApiError && error.problem.detail) {
        setFormError(error.problem.detail);
      } else {
        setFormError(findingsMessages.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={finding !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{findingsMessages.form.editTitle}</DialogTitle>
        </DialogHeader>

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
                  <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
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
              {submitting ? findingsMessages.form.submitting : findingsMessages.form.submitEdit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
