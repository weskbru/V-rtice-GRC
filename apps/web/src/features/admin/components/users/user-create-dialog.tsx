'use client';

/**
 * PharosGRC — Administration, create user dialog (T181, FR-021, FR-005).
 * The initial password is sent once and never re-displayed (FR-005, FR-035).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import {
  NONE_SELECT_VALUE,
  createUserFormSchema,
  toNullable,
  type CreateUserFormValues,
} from '@/lib/validation/admin';

import { adminApi } from '../../api';

import type { AdminUser, OrgUnitNode } from '../../types';

export interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgUnits: readonly OrgUnitNode[];
  onCreated: (user: AdminUser) => void;
}

export function UserCreateDialog({
  open,
  onOpenChange,
  orgUnits,
  onCreated,
}: UserCreateDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { email: '', fullName: '', jobTitle: '', orgUnitId: '', initialPassword: '' },
  });

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      form.reset();
      setFormError(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CreateUserFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      const user = await adminApi.createUser({
        email: values.email,
        fullName: values.fullName,
        jobTitle: toNullable(values.jobTitle),
        primaryOrgUnitId: toNullable(values.orgUnitId),
        initialPassword: values.initialPassword,
      });
      handleOpenChange(false);
      onCreated(user);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.problem.status === 409) {
          setFormError(admin.users.feedback.emailInUseError);
          return;
        }
        if (error.problem.status === 422 && error.problem.errors?.length) {
          for (const fieldError of error.problem.errors) {
            if (fieldError.field && fieldError.field in form.getValues()) {
              form.setError(fieldError.field as keyof CreateUserFormValues, {
                message: fieldError.message,
              });
            }
          }
          setFormError(admin.users.form.fixHighlightedFields);
          return;
        }
      }
      setFormError(admin.users.form.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{admin.users.form.createTitle}</DialogTitle>
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
            label={admin.users.form.fields.fullName.label}
            required
            error={form.formState.errors.fullName?.message}
          >
            {(field) => <Input {...field} {...form.register('fullName')} disabled={submitting} />}
          </FormField>

          <FormField
            label={admin.users.form.fields.email.label}
            required
            error={form.formState.errors.email?.message}
          >
            {(field) => (
              <Input {...field} type="email" {...form.register('email')} disabled={submitting} />
            )}
          </FormField>

          <FormField label={admin.users.form.fields.jobTitle.label}>
            {(field) => <Input {...field} {...form.register('jobTitle')} disabled={submitting} />}
          </FormField>

          <Controller
            control={form.control}
            name="orgUnitId"
            render={({ field }) => (
              <FormField label={admin.users.form.fields.orgUnit.label}>
                {(a11y) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                    <SelectTrigger id={a11y.id} className="w-full">
                      <SelectValue placeholder={admin.users.form.fields.orgUnit.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_SELECT_VALUE}>
                        {admin.users.form.fields.orgUnit.none}
                      </SelectItem>
                      {orgUnits.map((unit) => (
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

          <FormField
            label={admin.users.form.fields.initialPassword.label}
            required
            description={admin.users.form.fields.initialPassword.description}
            error={form.formState.errors.initialPassword?.message}
          >
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="new-password"
                {...form.register('initialPassword')}
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
              {admin.users.form.cancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {submitting ? admin.users.form.submitting : admin.users.form.submitCreate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
