import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PendingApprovalBadge } from './pending-approval-badge';

/**
 * Component-mount evidence for T162 (`PendingApprovalBadge`, FR-029c).
 * `risk-register-columns.test.tsx`'s own "flags pending approval alongside
 * the status badge" test exercises the SAME component through the register
 * column, not a second copy — this file covers the component directly.
 */
describe('PendingApprovalBadge', () => {
  it('renders nothing when no approval is pending', () => {
    const { container } = render(<PendingApprovalBadge pending={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the pending-approval indicator when an approval is pending', () => {
    render(<PendingApprovalBadge pending />);
    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
  });
});
