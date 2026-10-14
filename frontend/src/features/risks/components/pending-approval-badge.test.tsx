import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PendingApprovalBadge } from './pending-approval-badge';

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
