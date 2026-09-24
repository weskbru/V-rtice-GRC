import { describe, expect, it } from 'vitest';

import { navigationRegistry } from './navigation-registry';

describe('navigationRegistry', () => {
  it('has no duplicate ids', () => {
    const ids = navigationRegistry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows Dashboard as implemented with a real href', () => {
    const dashboard = navigationRegistry.find((entry) => entry.id === 'dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard?.status).toBe('implemented');
    expect(dashboard && 'href' in dashboard ? dashboard.href : undefined).toBe('/dashboard');
  });

  it('shows Risk Management as implemented, gated by risk:view (US2)', () => {
    const risks = navigationRegistry.find((entry) => entry.id === 'risks');
    expect(risks).toBeDefined();
    expect(risks?.status).toBe('implemented');
    expect(risks?.requiredPermission).toBe('risk:view');
    expect(risks && 'href' in risks ? risks.href : undefined).toBe('/risks');
  });

  it('shows "Minhas ações" as implemented, gated by action:view (002-shared-grc-foundation, US2, R-009)', () => {
    const myActions = navigationRegistry.find((entry) => entry.id === 'my-actions');
    expect(myActions).toBeDefined();
    expect(myActions?.status).toBe('implemented');
    expect(myActions?.requiredPermission).toBe('action:view');
    expect(myActions && 'href' in myActions ? myActions.href : undefined).toBe('/actions');
  });

  it('shows Controls as implemented, gated by control:view (003-controls-management, US1)', () => {
    const controlsEntry = navigationRegistry.find((entry) => entry.id === 'controls');
    expect(controlsEntry).toBeDefined();
    expect(controlsEntry?.status).toBe('implemented');
    expect(controlsEntry?.requiredPermission).toBe('control:view');
    expect(controlsEntry && 'href' in controlsEntry ? controlsEntry.href : undefined).toBe(
      '/controls',
    );
  });

  it('shows Compliance as implemented, gated by compliance:view (004-compliance-management, US1)', () => {
    const complianceEntry = navigationRegistry.find((entry) => entry.id === 'compliance');
    expect(complianceEntry).toBeDefined();
    expect(complianceEntry?.status).toBe('implemented');
    expect(complianceEntry?.requiredPermission).toBe('compliance:view');
    expect(complianceEntry && 'href' in complianceEntry ? complianceEntry.href : undefined).toBe(
      '/compliance',
    );
  });

  it('shows Audit Engagements as implemented, gated by audit-engagement:view (005-audit-findings, US1)', () => {
    const auditsEntry = navigationRegistry.find((entry) => entry.id === 'audits');
    expect(auditsEntry).toBeDefined();
    expect(auditsEntry?.status).toBe('implemented');
    expect(auditsEntry?.requiredPermission).toBe('audit-engagement:view');
    expect(auditsEntry && 'href' in auditsEntry ? auditsEntry.href : undefined).toBe('/audits');
  });

  it('shows Assets as implemented, gated by asset:view (006-assets-processes, T050)', () => {
    const assetsEntry = navigationRegistry.find((entry) => entry.id === 'assets');
    expect(assetsEntry).toBeDefined();
    expect(assetsEntry?.status).toBe('implemented');
    expect(assetsEntry?.requiredPermission).toBe('asset:view');
    expect(assetsEntry && 'href' in assetsEntry ? assetsEntry.href : undefined).toBe('/assets');
  });

  it('shows Processes as implemented, gated by process:view, symmetric with Assets (006-assets-processes, T050, FR-020)', () => {
    const processesEntry = navigationRegistry.find((entry) => entry.id === 'processes');
    expect(processesEntry).toBeDefined();
    expect(processesEntry?.status).toBe('implemented');
    expect(processesEntry?.requiredPermission).toBe('process:view');
    expect(processesEntry && 'href' in processesEntry ? processesEntry.href : undefined).toBe(
      '/processes',
    );
  });

  it('shows Problems as implemented, gated by problem:view (008-incidents-problems, US2)', () => {
    const problemsEntry = navigationRegistry.find((entry) => entry.id === 'problems');
    expect(problemsEntry).toBeDefined();
    expect(problemsEntry?.status).toBe('implemented');
    expect(problemsEntry?.requiredPermission).toBe('problem:view');
    expect(problemsEntry && 'href' in problemsEntry ? problemsEntry.href : undefined).toBe(
      '/problems',
    );
  });

  it('shows Incidents as implemented, gated by incident:view (008-incidents-problems, US1)', () => {
    const incidentsEntry = navigationRegistry.find((entry) => entry.id === 'incidents');
    expect(incidentsEntry).toBeDefined();
    expect(incidentsEntry?.status).toBe('implemented');
    expect(incidentsEntry?.requiredPermission).toBe('incident:view');
    expect(incidentsEntry && 'href' in incidentsEntry ? incidentsEntry.href : undefined).toBe(
      '/incidents',
    );
  });

  it('shows Indicators as implemented, gated by indicator:view (009-indicators-reports, T063)', () => {
    const indicatorsEntry = navigationRegistry.find((entry) => entry.id === 'indicators');
    expect(indicatorsEntry).toBeDefined();
    expect(indicatorsEntry?.status).toBe('implemented');
    expect(indicatorsEntry?.requiredPermission).toBe('indicator:view');
    expect(indicatorsEntry && 'href' in indicatorsEntry ? indicatorsEntry.href : undefined).toBe(
      '/indicators',
    );
  });

  it('shows Reports as implemented, gated by report:view (009-indicators-reports, T063)', () => {
    const reportsEntry = navigationRegistry.find((entry) => entry.id === 'reports');
    expect(reportsEntry).toBeDefined();
    expect(reportsEntry?.status).toBe('implemented');
    expect(reportsEntry?.requiredPermission).toBe('report:view');
    expect(reportsEntry && 'href' in reportsEntry ? reportsEntry.href : undefined).toBe('/reports');
  });

  it('shows the three Administration entries as implemented, each gated by its own administrative permission (US8)', () => {
    const expected = [
      { id: 'admin-users', requiredPermission: 'user:administer', href: '/admin/users' },
      { id: 'admin-roles', requiredPermission: 'role:administer', href: '/admin/roles' },
      {
        id: 'admin-organization',
        requiredPermission: 'org_unit:administer',
        href: '/admin/organization',
      },
    ] as const;

    for (const { id, requiredPermission, href } of expected) {
      const entry = navigationRegistry.find((candidate) => candidate.id === id);
      expect(entry).toBeDefined();
      expect(entry?.status).toBe('implemented');
      expect(entry?.requiredPermission).toBe(requiredPermission);
      expect(entry && 'href' in entry ? entry.href : undefined).toBe(href);
    }
  });

  const IMPLEMENTED_IDS = [
    'dashboard',
    'risks',
    'my-actions',
    'controls',
    'assets',
    'processes',
    'problems',
    'incidents',
    'compliance',
    'audits',
    'indicators',
    'reports',
    'admin-users',
    'admin-roles',
    'admin-organization',
  ];

  it('gives every entry the shape its own status requires (FR-043)', () => {
    for (const entry of navigationRegistry) {
      if (entry.status === 'implemented') {
        expect('href' in entry && entry.href.startsWith('/')).toBe(true);
      } else {
        expect(entry.status).toBe('planned');
        expect('href' in entry).toBe(false);
      }
    }
  });

  it('has exactly the implemented entries this test enumerates, and no others (FR-043)', () => {
    const implemented = navigationRegistry
      .filter((entry) => entry.status === 'implemented')
      .map((entry) => entry.id)
      .sort();

    expect(implemented).toEqual([...IMPLEMENTED_IDS].sort());
  });

  it('every entry carries a label and an icon component', () => {
    for (const entry of navigationRegistry) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.icon).toBeDefined();
    }
  });
});
