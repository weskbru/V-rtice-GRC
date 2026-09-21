'use client';

/**
 * PharosGRC — Administration, the detail panel's Permissions tab
 * (015-roles-permissions-surface FR-013 to FR-017, T036/T037/T038).
 *
 * ## The statement at the top is not decoration
 *
 * FR-015 requires the interface to state the platform's real authorization
 * model, because the interface is where the wrong mental model would form.
 * There is NO inheritance between roles anywhere in PharosGRC — permission
 * resolution is a flat `JOIN` over the roles directly assigned to a person,
 * deduplicated by a `Set` (`prisma-permission.repository.ts`) — so "herdada
 * de" and every suggestion of hierarchy are forbidden (SC-003), and what is
 * true is written instead.
 *
 * ## One taxonomy, the one that already exists
 *
 * Modules are `PermissionArea` from `permission-grouping.ts` — the same 14
 * areas the roles list, the module filter and the role form use.
 * Creating a second module taxonomy is forbidden (FR-013), and there is
 * nowhere else it could come from: `PermissionDefinition` has four fields
 * and none of them is an area.
 *
 * ## Identifiers are revealed, never rewritten
 *
 * The pt-BR label is the primary one and comes from the existing catalogue
 * (`permissionCatalog.verbs`/`.resources`/`.areas`); the real identifier
 * (`risk:view`) appears beside it on demand (FR-016), unchanged. The
 * description the API returns is still English (F-63) — it is secondary
 * text, shown with the technical identifiers it belongs with, and never a
 * primary label (FR-017).
 */
import { DisclosureGroup } from '@pharos/design-system/components';
import { Check, Info } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { admin } from '@/lib/messages/admin';

import { groupPermissionsByArea, permissionVerbLabel } from './permission-grouping';

import type { PermissionArea } from './permission-grouping';
import type { Role } from '../../types';

export interface RolePermissionsTabProps {
  role: Role;
  /** FR-016 — driven from the panel's footer toggle, so the whole tab reveals identifiers at once. */
  showIdentifiers: boolean;
}

/** FR-015 — the authorization model, said plainly, in the one place the reader would otherwise infer it. */
function AuthorizationModelNote(): React.JSX.Element {
  const model = admin.roles.permissionsTab.model;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={titleId} className="text-sm font-medium text-foreground">
          {model.title}
        </h3>
        <ul className="flex flex-col gap-0.5 text-xs leading-5 text-muted-foreground">
          <li>{model.directGrant}</li>
          <li>{model.noInheritance}</li>
          <li>{model.effectiveAccess}</li>
        </ul>
      </div>
    </section>
  );
}

export function RolePermissionsTab({
  role,
  showIdentifiers,
}: RolePermissionsTabProps): React.JSX.Element {
  const messages = admin.roles.permissionsTab;
  const areas = groupPermissionsByArea(role.permissions);
  const [openAreas, setOpenAreas] = useState<ReadonlySet<PermissionArea>>(new Set());
  const sectionTitleId = useId();

  const allOpen = areas.length > 0 && areas.every((area) => openAreas.has(area.area));

  function toggleArea(area: PermissionArea, open: boolean): void {
    setOpenAreas((current) => {
      const next = new Set(current);
      if (open) {
        next.add(area);
      } else {
        next.delete(area);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <AuthorizationModelNote />

      {areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.empty}</p>
      ) : (
        <section aria-labelledby={sectionTitleId} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={sectionTitleId} className="text-sm font-semibold text-foreground">
              {admin.roles.details.grantedPermissions}
            </h3>
            {/* FR-014 — every module at once, which is why `DisclosureGroup` is driven in its controlled mode here. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setOpenAreas(allOpen ? new Set() : new Set(areas.map((area) => area.area)))
              }
            >
              {allOpen ? messages.collapseAll : messages.expandAll}
            </Button>
          </div>

          {showIdentifiers ? (
            <p className="text-xs text-muted-foreground">{messages.identifiersHint}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            {areas.map((area) => (
              <DisclosureGroup
                key={area.area}
                headingLevel={4}
                title={area.label}
                meta={
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {messages.modulePermissionCount(area.permissionCount)}
                  </span>
                }
                open={openAreas.has(area.area)}
                onOpenChange={(open) => toggleArea(area.area, open)}
                contentClassName="flex flex-col gap-3"
              >
                {area.resources.map((resource) => (
                  <div key={resource.resource} className="flex flex-col gap-1.5">
                    {area.resources.length > 1 || resource.label !== area.label ? (
                      <p className="text-xs font-medium text-muted-foreground">{resource.label}</p>
                    ) : null}
                    <ul className="flex flex-col gap-1.5">
                      {resource.permissions.map((permission) => (
                        <li key={permission.identifier} className="flex items-start gap-2">
                          <Check
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-status-success-fg"
                          />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="text-sm text-foreground">
                                {permissionVerbLabel(permission)}
                              </span>
                              {showIdentifiers ? (
                                <code className="font-mono text-xs text-muted-foreground">
                                  {permission.identifier}
                                </code>
                              ) : null}
                            </div>
                            {/*
                             * The catalogue description is still English
                             * (F-63, out of scope here — correcting it means
                             * eight domain catalogues, the database and the
                             * seed). It is shown with the technical
                             * identifiers rather than in the default
                             * reading, so the pt-BR label is what a reader
                             * sees first and the English text appears only
                             * where technical detail was asked for.
                             */}
                            {showIdentifiers ? (
                              <p className="text-xs leading-5 text-muted-foreground">
                                {permission.description}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </DisclosureGroup>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
