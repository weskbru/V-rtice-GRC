import { z } from 'zod';

import { admin } from '../messages/admin';

export const NONE_SELECT_VALUE = '__none__';

export function toNullable(value: string): string | null {
  return value && value !== NONE_SELECT_VALUE ? value : null;
}

export const userFormSchema = z.object({
  email: z
    .string()
    .min(1, admin.users.validation.email.required)
    .email(admin.users.validation.email.invalid),
  fullName: z.string().min(1, admin.users.validation.fullName.required),
  jobTitle: z.string(),
  orgUnitId: z.string(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const createUserFormSchema = userFormSchema.extend({
  initialPassword: z.string().min(12, admin.users.validation.initialPassword.tooShort),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export const resetPasswordFormSchema = z
  .object({
    newPassword: z.string().min(12, admin.users.passwordDialog.validation.tooShort),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: admin.users.passwordDialog.validation.mismatch,
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

export const ROLE_NAME_MAX_LENGTH = 100;
export const ROLE_DESCRIPTION_MAX_LENGTH = 500;

export const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, admin.roles.validation.name.required)
    .max(ROLE_NAME_MAX_LENGTH, admin.roles.validation.name.tooLong),
  description: z
    .string()
    .min(1, admin.roles.validation.description.required)
    .max(ROLE_DESCRIPTION_MAX_LENGTH, admin.roles.validation.description.tooLong),
  permissionIdentifiers: z.array(z.string()).min(1, admin.roles.validation.permissions.required),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;

export const orgUnitFormSchema = z.object({
  code: z.string().min(1, admin.organization.validation.code.required),
  name: z.string().min(1, admin.organization.validation.name.required),
  parentId: z.string(),
});

export type OrgUnitFormValues = z.infer<typeof orgUnitFormSchema>;
