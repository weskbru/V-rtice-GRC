'use client';

/**
 * PharosGRC — the product's `<Link>` (`specs/014-institutional-loader` §2.3).
 *
 * Identical to `next/link` in every respect a caller can observe: same props,
 * same real `<a>` element (so middle-click, "open in new tab" and "copy link"
 * keep working), same prefetching, same `asChild`/`Slot` behaviour when nested
 * in a `<Button asChild>` or a `DropdownMenuItem`. The only addition is
 * `LinkPendingSignal`, which renders nothing and reports this link's own
 * `useLinkStatus().pending` to the shell's overlay.
 *
 * It exists so that coverage is a property of the component every screen
 * already uses, instead of something each screen has to remember. Nothing in
 * `apps/web` imports `next/link` directly any more — `eslint.config.mjs`
 * enforces that with `no-restricted-imports`, which is what keeps a new screen
 * covered without anyone thinking about it.
 */
// eslint-disable-next-line no-restricted-imports -- this module is the wrapper the rule points everything else at.
import NextLink from 'next/link';

import { LinkPendingSignal, useOptionalNavigate } from '@/components/shell/navigation-pending';

export type LinkProps = React.ComponentProps<typeof NextLink> & {
  /**
   * Set on a link rendered inside a Radix overlay that closes when it is
   * clicked — the account menu, the notifications popover.
   *
   * `useLinkStatus` is read from inside the link, and Radix unmounts the
   * overlay's content on select, so the reporting component stops existing in
   * the same instant the navigation starts: measured directly, a 2 s
   * navigation from the account menu showed nothing at all. The wait is
   * therefore reported by the shell's own transition (`useNavigate`), which
   * lives in a provider that never unmounts.
   *
   * The element stays a real `<a href>`, and a modified click (middle button,
   * Ctrl/Cmd/Shift/Alt) is left to the browser, so "open in new tab" and "copy
   * link address" keep working exactly as before.
   */
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
