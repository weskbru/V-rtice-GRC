import { z } from 'zod';

import { assets } from '../messages/assets';

export const assetFormSchema = z.object({
  name: z
    .string()
    .min(1, assets.form.validation.name.required)
    .max(300, assets.form.validation.name.tooLong),
  description: z.string(),
  orgUnitId: z.string().min(1, assets.form.validation.orgUnit.required),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;
