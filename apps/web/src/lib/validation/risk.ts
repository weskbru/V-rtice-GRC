import { z } from 'zod';

import { risks } from '../messages/risks';

export const NONE_SELECT_VALUE = '__none__';

export const riskFormSchema = z.object({
  title: z
    .string()
    .min(1, risks.validation.title.required)
    .max(300, risks.validation.title.tooLong),
  description: z.string().min(1, risks.validation.description.required),
  categoryId: z.string(),
  typeId: z.string(),
  originId: z.string(),
  orgUnitId: z.string().min(1, risks.validation.orgUnit.required),
  ownerUserId: z.string().min(1, risks.validation.owner.required),
  responsibleUserId: z.string(),
  identifiedOn: z.string().min(1),
  nextReviewOn: z.string(),
});

export type RiskFormValues = z.infer<typeof riskFormSchema>;

export function toNullable(value: string): string | null {
  return value && value !== NONE_SELECT_VALUE ? value : null;
}
