import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthProvider } from './auth-context';
import { usePermissions } from './permissions';
import { buildTestSession } from './test-fixtures/session';

/**
 * Component-mount evidence for T078 (`usePermissions`, FR-042, ADR-003).
 * Asserts advisory gating behavior only — see the module's own doc comment
 * for why this hook is never a security boundary.
 */

function Probe(): React.JSX.Element {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
  return (
    <ul>
      <li>{`risk:view=${hasPermission('risk:view')}`}</li>
      <li>{`risk:administer=${hasPermission('risk:administer')}`}</li>
      <li>{`any=${hasAnyPermission(['risk:administer', 'risk:view'])}`}</li>
      <li>{`all=${hasAllPermissions(['risk:administer', 'risk:view'])}`}</li>
    </ul>
  );
}

describe('usePermissions', () => {
  it('reports true only for permissions actually present in the session (advisory gating)', () => {
    const session = buildTestSession({ permissions: ['risk:view', 'risk:edit'] });
    render(
      <AuthProvider initialSession={session}>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText('risk:view=true')).toBeInTheDocument();
    expect(screen.getByText('risk:administer=false')).toBeInTheDocument();
    expect(screen.getByText('any=true')).toBeInTheDocument();
    expect(screen.getByText('all=false')).toBeInTheDocument();
  });

  it('reports false for every permission when the session grants none', () => {
    const session = buildTestSession({ permissions: [] });
    render(
      <AuthProvider initialSession={session}>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText('risk:view=false')).toBeInTheDocument();
    expect(screen.getByText('any=false')).toBeInTheDocument();
  });
});
