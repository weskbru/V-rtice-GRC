'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { UserPicker } from '@/components/directory/user-picker';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';
import { FormField } from '@vertice/design-system/components';

import { controlsApi } from '../api';
import { todayDateOnly } from '../date';

import type { UserRef } from '../types';

export interface ControlRemediationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  onCreated: () => void;
}

export function ControlRemediationDialog({
  open,
  onOpenChange,
  assessmentId,
  onCreated,
}: ControlRemediationDialogProps): React.JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState<UserRef | undefined>(undefined);
  const [dueOn, setDueOn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    responsible?: string;
    dueOn?: string;
  }>({});

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setTitle('');
      setDescription('');
      setResponsible(undefined);
      setDueOn('');
      setError(null);
      setFieldErrors({});
    }
    onOpenChange(next);
  }

  function validate(): boolean {
    const next: { title?: string; responsible?: string; dueOn?: string } = {};
    if (!title.trim()) next.title = controls.remediation.validation.titleRequired;
    if (!responsible) next.responsible = controls.remediation.validation.responsibleRequired;
    if (!dueOn) next.dueOn = controls.remediation.validation.dueOnRequired;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await controlsApi.createAssessmentAction(assessmentId, {
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        responsibleUserId: responsible!.id,
        dueOn,
      });
      feedback.success(controls.remediation.submitSuccess);
      handleOpenChange(false);
      onCreated();
    } catch {
      setError(controls.remediation.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{controls.remediation.dialogTitle}</DialogTitle>
          <DialogDescription>{controls.remediation.dialogDescription}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={controls.remediation.fields.title.label}
          required
          error={fieldErrors.title}
        >
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
          label={controls.remediation.fields.description.label}
          optionalIndicator={common.formField.optionalIndicator}
        >
          {(field) => (
            <Textarea
              {...field}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              disabled={submitting}
            />
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={controls.remediation.fields.responsible.label}
            required
            error={fieldErrors.responsible}
          >
            {() => (
              <UserPicker
                value={responsible}
                onChange={setResponsible}
                onSearch={(q) => controlsApi.searchUsers(q)}
                disabled={submitting}
                labels={{
                  placeholder: controls.remediation.fields.responsible.placeholder,
                  triggerAriaLabel: controls.remediation.fields.responsible.label,
                }}
              />
            )}
          </FormField>

          <FormField
            label={controls.remediation.fields.dueOn.label}
            required
            error={fieldErrors.dueOn}
          >
            {(field) => (
              <Input
                {...field}
                type="date"
                value={dueOn}
                min={todayDateOnly()}
                onChange={(event) => setDueOn(event.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {common.actions.cancel}
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting ? controls.remediation.submitting : controls.remediation.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
