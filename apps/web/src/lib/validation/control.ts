import { z } from 'zod';

import { controls } from '../messages/controls';

export const NONE_SELECT_VALUE = '__none__';

export const controlFormSchema = z.object({
  name: z
    .string()
    .min(1, controls.form.validation.name.required)
    .max(300, controls.form.validation.name.tooLong),
  description: z.string().min(1, controls.form.validation.description.required),
  orgUnitId: z.string().min(1, controls.form.validation.orgUnit.required),
  ownerUserId: z.string(),
  nature: z.string(),
  type: z.string(),
  frequency: z.string(),
});

export type ControlFormValues = z.infer<typeof controlFormSchema>;

export function toNullable(value: string): string | null {
  return value && value !== NONE_SELECT_VALUE ? value : null;
}
