import { z } from 'zod';

import { auditEngagements } from '../messages/audit-engagements';

/**
 * Client-side shape/presence validation for the audit engagement
 * create/edit form (T076). Mirrors `CreateAuditEngagementRequest`/
 * `UpdateAuditEngagementRequest` in `contracts/audit.openapi.yaml` on shape
 * only — full business validation (referenced org unit/user exist and are
 * active) happens exclusively on the server and arrives as 422 field
 * errors, exactly like `lib/validation/control.ts`'s/`lib/validation/risk
 * .ts`'s own convention.
 *
 * Every field here is required — unlike Control's optional owner/nature/
 * type/frequency, `CreateAuditEngagementRequest` requires
 * `objective`/`periodStart`/`periodEnd`/`orgUnitId`/`leadAuditorUserId` in
 * full (audit.openapi.yaml), so this schema has no `NONE_SELECT_VALUE`
 * sentinel to map away.
 */
export const auditEngagementFormSchema = z
  .object({
    objective: z
      .string()
      .min(1, auditEngagements.form.validation.objective.required)
      .max(2000, auditEngagements.form.validation.objective.tooLong),
    periodStart: z.string().min(1, auditEngagements.form.validation.periodStart.required),
    periodEnd: z.string().min(1, auditEngagements.form.validation.periodEnd.required),
    orgUnitId: z.string().min(1, auditEngagements.form.validation.orgUnit.required),
    leadAuditorUserId: z.string().min(1, auditEngagements.form.validation.leadAuditor.required),
  })
  .superRefine((values, ctx) => {
    if (
      values.periodStart &&
      values.periodEnd &&
      values.periodEnd < values.periodStart // both `YYYY-MM-DD` — lexicographic order matches calendar order
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodEnd'],
        message: auditEngagements.form.validation.periodEnd.beforeStart,
      });
    }
  });

export type AuditEngagementFormValues = z.infer<typeof auditEngagementFormSchema>;
