import { describe, expect, it } from 'vitest';

import { actionOriginHref } from './origin';

describe('actionOriginHref', () => {
  it('links RISK_TREATMENT to /risks/{originId} — the risk itself', () => {
    expect(actionOriginHref('RISK_TREATMENT', 'risk-1')).toBe('/risks/risk-1');
  });

  it('links INCIDENT to /incidents/{originId} — the incident itself', () => {
    expect(actionOriginHref('INCIDENT', 'incident-1')).toBe('/incidents/incident-1');
  });

  it('links PROBLEM to /problems/{originId} — the problem itself', () => {
    expect(actionOriginHref('PROBLEM', 'problem-1')).toBe('/problems/problem-1');
  });

  it('has no route for FINDING — a finding lives inside its audit engagement, no standalone detail route exists', () => {
    expect(actionOriginHref('FINDING', 'finding-1')).toBeUndefined();
  });

  it('has no route for CONTROL_ASSESSMENT — originId is the assessment, never the control', () => {
    expect(actionOriginHref('CONTROL_ASSESSMENT', 'assessment-1')).toBeUndefined();
  });
});
