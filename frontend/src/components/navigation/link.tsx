'use client';

// eslint-disable-next-line no-restricted-imports -- this module is the wrapper the rule points everything else at.
import NextLink from 'next/link';

import { LinkPendingSignal, useOptionalNavigate } from '@/components/shell/navigation-pending';

export type LinkProps = React.ComponentProps<typeof NextLink> & {
  readonly insideDismissingOverlay?: boolean;
};

export function Link({
  children,
  insideDismissingOverlay = false,
  onClick,
  ...props
}: LinkProps): React.JSX.Element {
  const navigate = useOptionalNavigate();

  if (!insideDismissingOverlay) {
    return (
      <NextLink {...props} onClick={onClick}>
        <LinkPendingSignal />
        {children}
      </NextLink>
    );
  }

  return (
    <NextLink
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const modified =
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
        if (modified || !navigate || typeof props.href !== 'string') return;
        event.preventDefault();
        navigate(props.href);
      }}
    >
      {children}
    </NextLink>
  );
}

export default Link;
