import { z } from 'zod';

import { compliance } from '../messages/compliance';

export const frameworkFormSchema = z.object({
  name: z
    .string()
    .min(1, compliance.frameworkForm.validation.name.required)
    .max(300, compliance.frameworkForm.validation.name.tooLong),
  description: z.string().min(1, compliance.frameworkForm.validation.description.required),
  origin: z.string().min(1, compliance.frameworkForm.validation.origin.required),
});

export type FrameworkFormValues = z.infer<typeof frameworkFormSchema>;

export const frameworkVersionFormSchema = z.object({
  label: z
    .string()
    .min(1, compliance.versionForm.validation.label.required)
    .max(100, compliance.versionForm.validation.label.tooLong),
});

export type FrameworkVersionFormValues = z.infer<typeof frameworkVersionFormSchema>;

export const requirementFormSchema = z.object({
  externalRef: z
    .string()
    .min(1, compliance.requirements.validation.externalRef.required)
    .max(100, compliance.requirements.validation.externalRef.tooLong),
  title: z
    .string()
    .min(1, compliance.requirements.validation.title.required)
    .max(300, compliance.requirements.validation.title.tooLong),
  description: z.string().min(1, compliance.requirements.validation.description.required),
});

export type RequirementFormValues = z.infer<typeof requirementFormSchema>;
