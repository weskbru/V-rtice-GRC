/**
 * PharosGRC — the pt-BR display name of a role
 * (CLAUDE.md §11.1 and §19.7, ADR-022 as amended 2026-09-14).
 *
 * ## One function, because there must be exactly one
 *
 * Every screen that prints a role's name — the card, the detail panel, the
 * delete confirmation, the "Outros papéis" line of the Users tab, the role
 * chips of the Users register, the role picker of the Papéis dialog, and the
 * "Papéis" line of the Perfil identity card — goes through here. A second
 * place that maps a role name to a label is the defect CLAUDE.md §19.7
 * forbids, and this repository shipped one for fourteen phases:
 * `profile.identity.roleLabels` named six of the twelve seeded roles, so the
 * same platform printed "Gestor de Riscos" for one person and "Compliance
 * Manager" for the next. It is gone; `role-display-name.single-catalogue.
 * test.ts` is what stops it coming back.
 *
 * ## Why this sits in `lib/` and not in `features/admin/`
 *
 * Two areas consume it — Administração and Perfil — so it belongs to
 * neither. It lives beside `lib/permissions.ts` for the same reason that one
 * does: a pure, cross-area helper about the platform's identity model. A
 * Perfil screen reaching into `features/admin/components/roles/` for its own
 * copy would be the coupling CLAUDE.md §2 exists to prevent.
 *
 * ## The fallback is the feature, not a gap
 *
 * `common.roleDisplayNames` is exhaustive over `SeededRoleName` — the
 * compiler rejects a missing entry, and `role-display-name.seed-sync.test.ts`
 * rejects a union that has drifted from `platform.seed.ts`. Any other name is
 * a role somebody created through the admin screens, and it is returned
 * **exactly as stored**, character for character. A custom role must never
 * acquire a translation, and must never be "corrected" towards one.
 *
 * ## Why `Object.hasOwn`, and not `map[name] ?? name`
 *
 * `common.roleDisplayNames` is an ordinary object literal, so it inherits
 * `Object.prototype`. A custom role legitimately named `constructor`,
 * `toString` or `valueOf` would make `map[name]` truthy — and the screen
 * would print a function's source where a role's name belongs. An own-property
 * check is the difference, and `role-display-name.test.ts` asserts it.
 *
 * ## This is presentation, and nothing else
 *
 * Nothing here is persisted, sent to the server, or used to look a role up.
 * `Role.name` remains the identifier the server knows, the `@unique` key
 * `upsertSystemRoles` upserts on, and the value the name field of the editor
 * reads and writes. Authorization never sees this function — the same
 * boundary ADR-021 draws around the privilege badge.
 */
import { common } from '@/lib/messages/common';

import type { SeededRoleName } from '@/features/admin/types';

const DISPLAY_NAMES: Readonly<Record<SeededRoleName, string>> = common.roleDisplayNames;

/**
 * The pt-BR name to print for a role, given its stored `Role.name`.
 *
 * Seeded role → its catalogue label. Anything else → the argument, unchanged.
 */
export function roleDisplayName(name: string): string {
  return Object.hasOwn(DISPLAY_NAMES, name) ? DISPLAY_NAMES[name as SeededRoleName] : name;
}
