import { z } from 'zod';

import { findings } from '../messages/findings';

export const createFindingFormSchema = z.object({
  title: z.string().min(1, findings.form.validation.title.required),
  description: z.string().min(1, findings.form.validation.description.required),
  recommendation: z.string(),
  category: z.string().min(1, findings.form.validation.category.required),
  origin: z.string().min(1, findings.form.validation.origin.required),
  severity: z.string().min(1, findings.form.validation.severity.required),
  priority: z.string().min(1, findings.form.validation.priority.required),
  ownerUserId: z.string().min(1, findings.form.validation.ownerUserId.required),
  identifiedOn: z.string().min(1, findings.form.validation.identifiedOn.required),
});

export type CreateFindingFormValues = z.infer<typeof createFindingFormSchema>;

export const editFindingFormSchema = z.object({
  title: z.string().min(1, findings.form.validation.title.required),
  description: z.string().min(1, findings.form.validation.description.required),
  recommendation: z.string(),
  category: z.string().min(1, findings.form.validation.category.required),
  severity: z.string().min(1, findings.form.validation.severity.required),
  priority: z.string().min(1, findings.form.validation.priority.required),
  ownerUserId: z.string().min(1, findings.form.validation.ownerUserId.required),
});

export type EditFindingFormValues = z.infer<typeof editFindingFormSchema>;
