import { z } from 'zod';

import { incidents } from '../messages/incidents';

export const incidentFormSchema = z.object({
  title: z
    .string()
    .min(1, incidents.form.validation.title.required)
    .max(300, incidents.form.validation.title.tooLong),
  description: z.string().min(1, incidents.form.validation.description.required),
  severity: z.string().min(1, incidents.form.validation.severity.required),
  orgUnitId: z.string().min(1, incidents.form.validation.orgUnit.required),
  ownerUserId: z.string(),
  reportedOn: z.string().min(1, incidents.form.validation.reportedOn.required),
});

export type IncidentFormValues = z.infer<typeof incidentFormSchema>;
