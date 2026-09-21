'use client';

/**
 * PharosGRC — Administration, the state behind composing a role inside a
 * panel: editing an existing one (015-roles-permissions-surface FR-026 to
 * FR-033, T042/T043/T044/T045) and creating a new one (Fase 1 de "Novo
 * papel").
 *
 * ## One editor, two targets
 *
 * `target` is the role being edited, or `null` when a new one is being
 * composed. Everything above the request — the name, the description, the
 * selected set, the catalogue fetch, the tri-state module arithmetic, the
 * shape validation and the 409 on a duplicate name — is IDENTICAL in both,
 * so it is written once (CLAUDE.md §19.4). Only `submit` differs, and it
 * differs in one expression: `POST /admin/roles` against `null`,
 * `PATCH /admin/roles/{id}` against a role.
 *
 * A created role is never a system role — `prisma-role.repository.ts:69`
 * forces `isSystem: false` — so the locked branch below simply cannot be
 * reached while `target` is `null`, and the interface must not suggest
 * otherwise.
 *
 * ## A system role is not editable AT ALL, and this hook never PATCHes one
 *
 * F-68, decided 2026-09-14: the platform owns a seeded role whole — name,
 * description and permission set. `RoleAdminService.update` now refuses a
 * request for a system role that brings ANY of the three, even values
 * identical to the stored ones. Until that decision `description` was
 * accepted here and reconciled back by the next seed run, so the field had
 * two writers and the audit trail recorded an edit the database did not
 * keep.
 *
 * The screen answers that by not offering the edit: `RoleDetailPanel` opens
 * a system role as a read-only definition sheet with no save control at all.
 * `submit` below is therefore unreachable for a locked target from the
 * panel — and refuses locally anyway, before any request, so that a future
 * caller cannot resurrect the doomed `PATCH` by simply rendering a save
 * button. It is not the protection (FR-033: the server's refusal stands
 * whatever this hook sends); it is the client declining to send what it
 * knows will be refused.
 *
 * The earlier defect this paragraph used to describe is still guarded, one
 * layer up: sending the unchanged permission set made EVERY save of a system
 * role fail (`specs/012-admin-roles-screen/STATE.md` §3.1). No request at
 * all is a superset of that fix, and it is asserted as such in
 * `role-admin-view.test.tsx`.
 *
 * ## Why the catalogue is fetched only for a custom role
 *
 * Composing a role needs every permission that EXISTS, which is
 * `GET /admin/permissions`. A system role cannot change its permission set
 * at all, so that request would buy nothing: its tree is built from the
 * permissions the role already carries, which the listing already returned.
 * One request when it can change something, none when it cannot.
 */
import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { roleFormSchema } from '@/lib/validation/admin';

import { adminApi } from '../../api';

import type { Permission, Role } from '../../types';

/** A single frozen empty array, so "no permissions yet" is a stable reference and does not re-run the memos on every render. */
const EMPTY_PERMISSIONS: readonly Permission[] = [];

export interface RoleEditorFieldErrors {
  name?: string;
  description?: string;
  permissions?: string;
}

export interface RoleEditorPendingChanges {
  readonly nameChanged: boolean;
  readonly descriptionChanged: boolean;
  /** Identifiers the save would ADD, in catalogue order. */
  readonly added: readonly Permission[];
  /** Identifiers the save would REMOVE, in the order the role holds them. */
  readonly removed: readonly Permission[];
  readonly hasChanges: boolean;
}

export interface UseRoleEditorResult {
  /** `true` while composing a NEW role — no target, and therefore nothing that could be locked. */
  readonly isCreating: boolean;
  /** `true` only for an existing SYSTEM role: name and permissions are read-only and the request carries `description` alone. */
  readonly isLocked: boolean;
  readonly name: string;
  readonly description: string;
  readonly selected: ReadonlySet<string>;
  /** The permission tree the editor renders: the whole catalogue for a custom role, the role's own grants for a system role (which cannot change them). */
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
  /** Selects or clears a whole module at once — the tri-state module checkbox (FR-028). */
  readonly setPermissions: (identifiers: readonly string[], selected: boolean) => void;
  /** FR-032 — restores every field to the stored role and clears the errors, persisting nothing. Called when editing starts and when it is cancelled. */
  readonly reset: () => void;
  readonly submit: () => Promise<Role | null>;
}

/**
 * @param target the role being edited, or `null` to compose a new one.
 * @param enabled whether the editor is actually in use. The detail panel
 * keeps this hook mounted while reading as well — unmounting it would
 * unmount the `Sheet` around it below `xl`, closing the overlay every time
 * the user pressed "Editar papel" — so the permission catalogue request is
 * gated here instead. Reading a role must not cost a request the reader's
 * action did not ask for (NFR-006).
 */
export function useRoleEditor(target: Role | null, enabled: boolean): UseRoleEditorResult {
  const isCreating = target === null;
  const isLocked = target?.isSystem === true;
  // A new role starts empty; an existing one starts at what is stored.
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

  // The component is mounted only while editing and is keyed by the role, so
  // "mount" and "a different role is being edited" are the same event — no
  // reset effect is needed, exactly as `RoleEditDialog` documented.
  useEffect(() => {
    // A system role's set cannot change, so the whole catalogue would buy
    // nothing. A NEW role's set is composed from the catalogue, so it must.
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

  // Memoized so it is a stable reference: `pending` below depends on it, and
  // a fresh array each render would recompute the diff on every keystroke.
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

  /**
   * Drops the field's own error as soon as the field changes.
   *
   * Measured on screen, not reasoned about: after an empty submit the panel
   * showed "Selecione ao menos uma permissão." above a tree with ten
   * permissions ticked. A validation message that survives the correction it
   * asked for stops being guidance and becomes noise — and this one was
   * actively false. The message returns on the next submit if the field is
   * still invalid, because `submit` re-validates every field.
   */
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
    // F-68 — nothing on a system role is writable, so there is no request to
    // make. Refused here rather than sent and refused by the server, so the
    // user is not charged a round trip for an outcome the client already
    // knows (see this file's header for why this is not the protection).
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
        // A created role is always custom, so the full payload is always
        // the right one here — there is no system-role branch to take.
        return await adminApi.createRole({ name, description, permissionIdentifiers });
      }
      // Only a CUSTOM role reaches here — the `isLocked` refusal above is
      // the system-role branch, and it makes no request at all (F-68). The
      // full payload is therefore always the right one.
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
          /*
           * The system-role refusal cannot reach here at all any more (F-68:
           * a locked target returns above, without a request), and it never
           * could apply to a role that does not exist yet. Whatever produced
           * this 422 — an unknown permission identifier, a field the server
           * rejected — is about the DATA, on both paths, so both say so.
           * Naming the system-role rule here would misinform the one person
           * who could act on the real cause.
           */
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
