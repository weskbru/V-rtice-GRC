import { z } from 'zod';

import { reports } from '@/lib/messages/reports';

export const reportFormSchema = z.object({
  name: z.string().min(1, reports.form.validation.name.required),
  description: z.string().min(1, reports.form.validation.description.required),
  metricKeys: z.array(z.string()).min(1, reports.form.validation.metricKeys.required),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;
