'use client';

/**
 * PharosGRC — action detail, edit form. Edits exactly the four fields
 * `UpdateActionRequest` accepts — title, description, responsible, due
 * date — nothing else (origin, org unit and status are read-only here;
 * status changes only through a lifecycle transition, `ActionLifecycleActions`).
 *
 * Submits only the fields that actually changed from the loaded `action`
 * (a `PATCH` with every field restated would still be correct — the server
 * accepts a partial body — but sending only the diff keeps the audit
 * trail's own "changed fields" honest: `AUDIT_FIELD_LABELS`-driven rows in
 * `ActionAuditSection` should reflect what a person actually touched).
 */
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { UserPicker } from '@/components/directory/user-picker';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';

import { actionsApi } from '../api';

import type { Action, UpdateActionRequest } from '../types';

export interface ActionEditFormProps {
  action: Action;
  onSaved: (updated: Action) => void;
  onCancel: () => void;
}

interface FieldErrors {
  title?: string;
  responsible?: string;
  dueOn?: string;
}

export function ActionEditForm({
  action,
  onSaved,
  onCancel,
}: ActionEditFormProps): React.JSX.Element {
  const form = actions.detail.form;

  const [title, setTitle] = useState(action.title);
  const [description, setDescription] = useState(action.description ?? '');
  // Initialized from the loaded `action` itself, never from a fetched
  // list (S-10) — `action.responsible` already carries its own `fullName`,
  // so the current value's label is known even when this user falls
  // outside whatever page a directory search would return.
  const [responsible, setResponsible] = useState(action.responsible);
  const [dueOn, setDueOn] = useState(action.dueOn);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!title.trim()) next.title = form.validation.titleRequired;
    if (!dueOn) next.dueOn = form.validation.dueOnRequired;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  /** Only the fields that actually differ from the loaded `action` — see this file's own header. A key omitted entirely means "not part of this request", never "clear this field" (there is no way to clear `title`/`responsibleUserId`/`dueOn` — all three are required on `Action` itself; `description` clears via an explicit empty string, distinct from "unchanged"). */
  function buildDiff(): UpdateActionRequest {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const previousDescription = action.description ?? '';

    return {
      ...(trimmedTitle !== action.title ? { title: trimmedTitle } : {}),
      ...(trimmedDescription !== previousDescription ? { description: trimmedDescription } : {}),
      ...(responsible.id !== action.responsible.id ? { responsibleUserId: responsible.id } : {}),
      ...(dueOn !== action.dueOn ? { dueOn } : {}),
    };
  }

  async function handleSubmit(): Promise<void> {
    setError(null);
    if (!validate()) return;

    const diff = buildDiff();
    if (Object.keys(diff).length === 0) {
      onCancel();
      return;
    }

    setSubmitting(true);
    try {
      const updated = await actionsApi.updateAction(action.id, diff);
      feedback.success(form.updateSuccess);
      onSaved(updated);
    } catch (caught) {
      const detail = caught instanceof ApiError ? caught.problem.detail : undefined;
      setError(detail ?? form.updateError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-sm font-medium text-status-danger-fg">
          {error}
        </p>
      ) : null}

      <FormField label={form.titleLabel} required error={fieldErrors.title}>
        {(field) => (
          <Input
            {...field}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField
        label={form.descriptionLabel}
        optionalIndicator={common.formField.optionalIndicator}
      >
        {(field) => (
          <Textarea
            {...field}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            disabled={submitting}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={form.responsibleLabel} required error={fieldErrors.responsible}>
          {() => (
            <UserPicker
              value={responsible}
              onChange={setResponsible}
              onSearch={(query) => actionsApi.searchUsers(query)}
              disabled={submitting}
              labels={{
                placeholder: form.responsiblePlaceholder,
                triggerAriaLabel: form.responsibleLabel,
              }}
            />
          )}
        </FormField>

        <FormField label={form.dueOnLabel} required error={fieldErrors.dueOn}>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
          {form.cancel}
        </Button>
        <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
          {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {submitting ? form.submitting : form.submit}
        </Button>
      </div>
    </div>
  );
}
