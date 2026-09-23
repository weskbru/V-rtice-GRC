import type { CurrentSession } from '../auth-types';

export function buildTestSession(overrides: Partial<CurrentSession> = {}): CurrentSession {
  return {
    user: {
      id: 'user-1',
      email: 'analyst@pharosgrc.local',
      fullName: 'Ada Analyst',
      jobTitle: 'Risk Analyst',
      status: 'ACTIVE',
      primaryOrgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
      roles: [{ id: 'role-1', name: 'Risk Analyst' }],
      lastLoginAt: '2026-01-01T00:00:00.000Z',
    },
    permissions: ['risk:view'],
    scope: { global: false, orgUnitIds: ['org-1'] },
    session: {
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
      lastActivityAt: '2026-01-01T00:00:00.000Z',
      authenticationMethod: 'LOCAL',
      ipAddress: null,
      userAgent: null,
    },
    ...overrides,
  };
}
