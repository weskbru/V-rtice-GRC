'use client';

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
  showIdentifiers: boolean;
}

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
