import { z } from 'zod';

import { auditEngagements } from '../messages/audit-engagements';

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
    if (values.periodStart && values.periodEnd && values.periodEnd < values.periodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodEnd'],
        message: auditEngagements.form.validation.periodEnd.beforeStart,
      });
    }
  });

export type AuditEngagementFormValues = z.infer<typeof auditEngagementFormSchema>;
