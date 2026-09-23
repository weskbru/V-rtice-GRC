'use client';

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
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { evidence as evidenceMessages } from '@/lib/messages/evidence';
import { createEvidenceFormSchema, type CreateEvidenceFormValues } from '@/lib/validation/evidence';

import { evidenceApi } from '../api';

import type { Evidence, EvidenceSource, EvidenceSubjectType, EvidenceType } from '../types';
import type { UserRef } from '@/features/risks/types';

const OPTIONAL = common.formField.optionalIndicator;

const EVIDENCE_TYPES: readonly EvidenceType[] = [
  'DOCUMENT',
  'SCREENSHOT',
  'SYSTEM_LOG',
  'ATTESTATION',
  'INSPECTION',
  'OTHER',
];

const EVIDENCE_SOURCES: readonly EvidenceSource[] = [
  'MANUAL_UPLOAD',
  'SYSTEM_EXPORT',
  'THIRD_PARTY',
  'INSPECTION',
];

function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface EvidenceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgUnitId: string;
  subjectType: EvidenceSubjectType;
  subjectId: string;
  defaultOwnerUserId: string;
  onCreated: (evidence: Evidence) => void;
}

export function EvidenceCreateDialog({
  open,
  onOpenChange,
  orgUnitId,
  subjectType,
  subjectId,
  defaultOwnerUserId,
  onCreated,
}: EvidenceCreateDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const defaultOwner: UserRef | undefined =
    currentUser.id === defaultOwnerUserId
      ? { id: currentUser.id, fullName: currentUser.fullName, email: currentUser.email }
      : undefined;
  const [owner, setOwner] = useState<UserRef | undefined>(defaultOwner);
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<CreateEvidenceFormValues>({
    resolver: zodResolver(createEvidenceFormSchema),
    defaultValues: {
      title: '',
      description: '',
      type: '',
      source: '',
      ownerUserId: defaultOwnerUserId,
      collectedOn: todayDateOnly(),
      validUntil: '',
      externalUrl: '',
      observation: '',
      note: '',
    },
  });

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      form.reset();
      setOwner(defaultOwner);
      setFormError(null);
      setFile(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CreateEvidenceFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await evidenceApi.createEvidence({
        orgUnitId,
        title: values.title,
        description: values.description || undefined,
        type: values.type as EvidenceType,
        source: values.source as EvidenceSource,
        ownerUserId: values.ownerUserId,
        collectedOn: values.collectedOn,
        validUntil: values.validUntil || undefined,
        externalUrl: values.externalUrl || undefined,
        observation: values.observation || undefined,
      });

      try {
        await evidenceApi.linkEvidence(created.id, {
          subjectType,
          subjectId,
          note: values.note || undefined,
        });
      } catch {
        setFormError(evidenceMessages.panel.linkError);
        onCreated(created);
        setSubmitting(false);
        return;
      }

      if (file) {
        try {
          await evidenceApi.uploadAttachment(created.id, file);
        } catch {}
      }

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
            form.setError(fieldError.field as keyof CreateEvidenceFormValues, {
              message: fieldError.message,
            });
          }
        }
        setFormError(evidenceMessages.form.fixHighlightedFields);
      } else if (error instanceof ApiError && error.problem.detail) {
        setFormError(error.problem.detail);
      } else {
        setFormError(evidenceMessages.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{evidenceMessages.form.title}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            void form.handleSubmit(onSubmit)(event);
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-muted-foreground">{evidenceMessages.form.description}</p>

          {formError ? (
            <p
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            >
              {formError}
            </p>
          ) : null}

          <FormField
            label={evidenceMessages.form.fields.title.label}
            required
            error={form.formState.errors.title?.message}
          >
            {(field) => <Input {...field} {...form.register('title')} disabled={submitting} />}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormField
                  label={evidenceMessages.form.fields.type.label}
                  required
                  error={form.formState.errors.type?.message}
                >
                  {(a11y) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting}
                    >
                      <SelectTrigger id={a11y.id} className="w-full">
                        <SelectValue placeholder={evidenceMessages.form.fields.type.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {EVIDENCE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {evidenceMessages.typeLabels[type]}
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
              name="source"
              render={({ field }) => (
                <FormField
                  label={evidenceMessages.form.fields.source.label}
                  required
                  error={form.formState.errors.source?.message}
                >
                  {(a11y) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting}
                    >
                      <SelectTrigger id={a11y.id} className="w-full">
                        <SelectValue
                          placeholder={evidenceMessages.form.fields.source.placeholder}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {EVIDENCE_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>
                            {evidenceMessages.sourceLabels[source]}
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
                label={evidenceMessages.form.fields.ownerUserId.label}
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
                    onSearch={(q) => evidenceApi.searchUsers(q)}
                    disabled={submitting}
                    labels={{
                      placeholder: evidenceMessages.form.fields.ownerUserId.label,
                      triggerAriaLabel: evidenceMessages.form.fields.ownerUserId.label,
                    }}
                  />
                )}
              </FormField>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={evidenceMessages.form.fields.collectedOn.label}
              required
              error={form.formState.errors.collectedOn?.message}
            >
              {(field) => (
                <Input
                  type="date"
                  {...field}
                  {...form.register('collectedOn')}
                  disabled={submitting}
                />
              )}
            </FormField>

            <FormField
              label={evidenceMessages.form.fields.validUntil.label}
              optionalIndicator={OPTIONAL}
            >
              {(field) => (
                <Input
                  type="date"
                  {...field}
                  {...form.register('validUntil')}
                  disabled={submitting}
                />
              )}
            </FormField>
          </div>

          <FormField
            label={evidenceMessages.form.fields.description.label}
            optionalIndicator={OPTIONAL}
          >
            {(field) => (
              <Textarea
                {...field}
                {...form.register('description')}
                disabled={submitting}
                rows={2}
              />
            )}
          </FormField>

          <p className="text-xs text-muted-foreground">{evidenceMessages.form.substanceHint}</p>

          <FormField
            label={evidenceMessages.form.fields.externalUrl.label}
            optionalIndicator={OPTIONAL}
            error={form.formState.errors.externalUrl?.message}
          >
            {(field) => (
              <Input
                type="url"
                {...field}
                {...form.register('externalUrl')}
                disabled={submitting}
              />
            )}
          </FormField>

          <FormField
            label={evidenceMessages.form.fields.observation.label}
            optionalIndicator={OPTIONAL}
            error={form.formState.errors.observation?.message}
          >
            {(field) => (
              <Textarea
                {...field}
                {...form.register('observation')}
                disabled={submitting}
                rows={3}
              />
            )}
          </FormField>

          <FormField
            label={evidenceMessages.form.fields.note.label}
            optionalIndicator={OPTIONAL}
            error={form.formState.errors.note?.message}
          >
            {(field) => <Input {...field} {...form.register('note')} disabled={submitting} />}
          </FormField>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="evidence-file-input" className="text-sm font-medium">
              {evidenceMessages.form.fields.file.label} {OPTIONAL}
            </label>
            <input
              id="evidence-file-input"
              type="file"
              disabled={submitting}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              {evidenceMessages.form.cancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {submitting ? evidenceMessages.form.submitting : evidenceMessages.form.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
