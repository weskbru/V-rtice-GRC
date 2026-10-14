'use client';

import { CalendarClock, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import { FormField, StatusBadge } from '@vertice/design-system/components';

import { risksApi } from '../api';
import { formatDateOnly } from '../date';

import type { RiskDetail } from '../types';

export interface RiskReviewScheduleProps {
  risk: RiskDetail;
  etag: string;
  onSaved: (result: { risk: RiskDetail; etag: string }) => void;
}

export function RiskReviewSchedule({
  risk,
  etag,
  onSaved,
}: RiskReviewScheduleProps): React.JSX.Element {
  const [value, setValue] = useState(risk.nextReviewOn ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      const result = await risksApi.updateRisk(
        risk.id,
        { nextReviewOn: value ? value : null },
        etag,
      );
      feedback.success(risks.assessment.reviewSchedule.saveSuccess);
      onSaved(result);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.problem.status === 409) {
        setError(risks.causesConsequences.conflictError);
      } else {
        setError(risks.assessment.reviewSchedule.saveError);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{risks.assessment.reviewSchedule.cardTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground">
            {risks.assessment.reviewSchedule.currentLabel}:{' '}
            {risk.nextReviewOn
              ? formatDateOnly(risk.nextReviewOn)
              : risks.assessment.reviewSchedule.notSet}
          </span>
          {risk.overdueReview ? (
            <StatusBadge
              variant="danger"
              label={risks.assessment.reviewSchedule.overdueLabel}
              icon={CalendarClock}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <FormField
            id="next-review-on"
            label={risks.assessment.reviewSchedule.fieldLabel}
            optionalIndicator={common.formField.optionalIndicator}
          >
            {(field) => (
              <Input
                {...field}
                type="date"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={saving}
              />
            )}
          </FormField>
          <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
            {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {saving
              ? risks.assessment.reviewSchedule.saving
              : risks.assessment.reviewSchedule.saveAction}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
