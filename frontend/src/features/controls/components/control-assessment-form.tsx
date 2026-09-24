'use client';

import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { controls } from '@/lib/messages/controls';

import { controlsApi } from '../api';
import { todayDateOnly } from '../date';

import type { ControlAssessmentResult } from '../types';

export interface ControlAssessmentFormProps {
  controlId: string;
  controlIsActive: boolean;
  onAssessed: () => void;
}

export function ControlAssessmentForm({
  controlId,
  controlIsActive,
  onAssessed,
}: ControlAssessmentFormProps): React.JSX.Element {
  const [assessedOn, setAssessedOn] = useState(todayDateOnly());
  const [result, setResult] = useState<ControlAssessmentResult | ''>('');
  const [conclusion, setConclusion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ result?: string; conclusion?: string }>({});

  function validate(): boolean {
    const nextErrors: { result?: string; conclusion?: string } = {};
    if (!result) {
      nextErrors.result = controls.assessment.form.validation.resultRequired;
    }
    if (!conclusion.trim()) {
      nextErrors.conclusion = controls.assessment.form.validation.conclusionRequired;
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setFormError(null);
    if (!validate() || !result) return;

    setSubmitting(true);
    try {
      await controlsApi.createAssessment(controlId, { assessedOn, result, conclusion });
      feedback.success(controls.assessment.form.submitSuccess);
      setResult('');
      setConclusion('');
      setAssessedOn(todayDateOnly());
      onAssessed();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.problem.detail ?? controls.assessment.form.genericError);
      } else {
        setFormError(controls.assessment.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{controls.assessment.form.cardTitle}</CardTitle>
        <CardDescription>{controls.assessment.form.cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {!controlIsActive ? (
          <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-fg">
            {controls.assessment.form.notActiveNotice}
          </p>
        ) : (
          <form
            onSubmit={(event) => void handleSubmit(event)}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={controls.assessment.form.fields.assessedOn.label} required>
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    max={todayDateOnly()}
                    value={assessedOn}
                    onChange={(event) => setAssessedOn(event.target.value)}
                    disabled={submitting}
                  />
                )}
              </FormField>

              <FormField
                label={controls.assessment.form.fields.result.label}
                required
                error={fieldErrors.result}
              >
                {(field) => (
                  <Select
                    value={result}
                    onValueChange={(value) => setResult(value as ControlAssessmentResult)}
                    disabled={submitting}
                  >
                    <SelectTrigger id={field.id} aria-invalid={field['aria-invalid']}>
                      <SelectValue
                        placeholder={controls.assessment.form.fields.result.placeholder}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(controls.assessmentResultLabels) as ControlAssessmentResult[]
                      ).map((value) => (
                        <SelectItem key={value} value={value}>
                          {controls.assessmentResultLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>

            <FormField
              label={controls.assessment.form.fields.conclusion.label}
              required
              description={controls.assessment.form.fields.conclusion.description}
              error={fieldErrors.conclusion}
            >
              {(field) => (
                <Textarea
                  {...field}
                  value={conclusion}
                  onChange={(event) => setConclusion(event.target.value)}
                  rows={3}
                  disabled={submitting}
                />
              )}
            </FormField>

            <div>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                {submitting
                  ? controls.assessment.form.actions.submitting
                  : controls.assessment.form.actions.submit}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
