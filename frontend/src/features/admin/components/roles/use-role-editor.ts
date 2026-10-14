'use client';

import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { roleFormSchema } from '@/lib/validation/admin';

import { adminApi } from '../../api';

import type { Permission, Role } from '../../types';

const EMPTY_PERMISSIONS: readonly Permission[] = [];

export interface RoleEditorFieldErrors {
  name?: string;
  description?: string;
  permissions?: string;
}

export interface RoleEditorPendingChanges {
  readonly nameChanged: boolean;
  readonly descriptionChanged: boolean;
  readonly added: readonly Permission[];
  readonly removed: readonly Permission[];
  readonly hasChanges: boolean;
}

export interface UseRoleEditorResult {
  readonly isCreating: boolean;
  readonly isLocked: boolean;
  readonly name: string;
  readonly description: string;
  readonly selected: ReadonlySet<string>;
  readonly treePermissions: readonly Permission[];
  readonly catalogLoading: boolean;
  readonly catalogError: boolean;
  readonly submitting: boolean;
  readonly formError: string | null;
  readonly fieldErrors: RoleEditorFieldErrors;
  readonly pending: RoleEditorPendingChanges;
  readonly setName: (value: string) => void;
  readonly setDescription: (value: string) => void;
  readonly togglePermission: (identifier: string) => void;
  readonly setPermissions: (identifiers: readonly string[], selected: boolean) => void;
  readonly reset: () => void;
  readonly submit: () => Promise<Role | null>;
}

export function useRoleEditor(target: Role | null, enabled: boolean): UseRoleEditorResult {
  const isCreating = target === null;
  const isLocked = target?.isSystem === true;
  const storedPermissions = target?.permissions ?? EMPTY_PERMISSIONS;

  const [name, setName] = useState(target?.name ?? '');
  const [description, setDescription] = useState(target?.description ?? '');
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(storedPermissions.map((permission) => permission.identifier)),
  );
  const [catalog, setCatalog] = useState<readonly Permission[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RoleEditorFieldErrors>({});

  useEffect(() => {
    if (!enabled || isLocked) return;
    let cancelled = false;
    adminApi
      .listPermissions()
      .then((permissions) => {
        if (cancelled) return;
        setCatalog(permissions);
        setCatalogError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, isLocked]);

  const treePermissions = useMemo(
    () => (isLocked ? storedPermissions : (catalog ?? EMPTY_PERMISSIONS)),
    [isLocked, storedPermissions, catalog],
  );

  const storedName = target?.name ?? '';
  const storedDescription = target?.description ?? '';

  const pending = useMemo<RoleEditorPendingChanges>(() => {
    const original = new Set(storedPermissions.map((permission) => permission.identifier));
    const added = treePermissions.filter(
      (permission) => selected.has(permission.identifier) && !original.has(permission.identifier),
    );
    const removed = storedPermissions.filter((permission) => !selected.has(permission.identifier));
    const nameChanged = name !== storedName;
    const descriptionChanged = description !== storedDescription;
    return {
      nameChanged,
      descriptionChanged,
      added,
      removed,
      hasChanges: nameChanged || descriptionChanged || added.length > 0 || removed.length > 0,
    };
  }, [
    storedPermissions,
    storedName,
    storedDescription,
    treePermissions,
    selected,
    name,
    description,
  ]);

  function reset(): void {
    setName(storedName);
    setDescription(storedDescription);
    setSelected(new Set(storedPermissions.map((permission) => permission.identifier)));
    setFieldErrors({});
    setFormError(null);
  }

  function clearFieldError(field: keyof RoleEditorFieldErrors): void {
    setFieldErrors((current) =>
      current[field] === undefined ? current : { ...current, [field]: undefined },
    );
  }

  function changeName(value: string): void {
    setName(value);
    clearFieldError('name');
  }

  function changeDescription(value: string): void {
    setDescription(value);
    clearFieldError('description');
  }

  function togglePermission(identifier: string): void {
    clearFieldError('permissions');
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      return next;
    });
  }

  function setPermissions(identifiers: readonly string[], shouldSelect: boolean): void {
    clearFieldError('permissions');
    setSelected((current) => {
      const next = new Set(current);
      for (const identifier of identifiers) {
        if (shouldSelect) {
          next.add(identifier);
        } else {
          next.delete(identifier);
        }
      }
      return next;
    });
  }

  async function submit(): Promise<Role | null> {
    if (isLocked) {
      setFormError(admin.roles.feedback.systemRoleNotEditableError);
      return null;
    }

    const permissionIdentifiers = Array.from(selected);
    const parsed = roleFormSchema.safeParse({ name, description, permissionIdentifiers });
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name: flattened.name?.[0],
        description: flattened.description?.[0],
        permissions: flattened.permissionIdentifiers?.[0],
      });
      setFormError(null);
      return null;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      if (target === null) {
        return await adminApi.createRole({ name, description, permissionIdentifiers });
      }
      const updated = await adminApi.updateRole(target.id, {
        name,
        description,
        permissionIdentifiers,
      });
      return updated;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.problem.status === 409) {
          setFormError(admin.roles.feedback.nameInUseError);
          return null;
        }
        if (error.problem.status === 422) {
          setFormError(admin.roles.create.invalidError);
          return null;
        }
      }
      setFormError(
        target === null ? admin.roles.create.genericError : admin.roles.edit.genericError,
      );
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    isCreating,
    isLocked,
    name,
    description,
    selected,
    treePermissions,
    catalogLoading: enabled && !isLocked && catalog === null && !catalogError,
    catalogError,
    submitting,
    formError,
    fieldErrors,
    pending,
    setName: changeName,
    setDescription: changeDescription,
    togglePermission,
    setPermissions,
    reset,
    submit,
  };
}
