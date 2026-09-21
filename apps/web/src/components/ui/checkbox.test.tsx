import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from '@/components/ui/checkbox';

/**
 * T003/T004 (015-roles-permissions-surface).
 *
 * `Checkbox` gained a third state: `checked="indeterminate"`, for a module
 * whose permissions are only partly selected. Two things had to be true and
 * neither was covered before:
 *
 * 1. The indeterminate state must be distinguishable from "checked" by
 *    SHAPE, not only by tint — CLAUDE.md §18.8 / NFR-004. The primitive
 *    used to render the same `CheckIcon` for both.
 * 2. Every one of the eleven existing call sites — all controlled, all
 *    boolean, none of which ever passes `'indeterminate'` — must behave
 *    exactly as before.
 *
 * ## What jsdom can and cannot prove here
 *
 * Which glyph is VISIBLE is decided by a Tailwind `group-data-[state=…]`
 * variant, and jsdom evaluates no stylesheet, so both glyph elements are in
 * the DOM in these tests regardless of state. What is asserted instead is
 * everything that actually carries the guarantee: the state Radix reports
 * to assistive technology (`aria-checked`, `data-state`), the existence of
 * a second, differently-shaped glyph element, and the complementary
 * visibility classes that select between them. Deleting the `MinusIcon`
 * branch from `checkbox.tsx` fails these tests; the same named-group idiom
 * is already proven in the rendered browser by `avatar.tsx` and `tabs.tsx`.
 */

function glyphs(container: HTMLElement): {
  check: Element | null;
  indeterminate: Element | null;
} {
  return {
    check: container.querySelector('[data-slot="checkbox-check-glyph"]'),
    indeterminate: container.querySelector('[data-slot="checkbox-indeterminate-glyph"]'),
  };
}

describe('Checkbox — indeterminate state (T003)', () => {
  it('reports aria-checked="mixed" and data-state="indeterminate" to assistive technology', () => {
    render(<Checkbox aria-label="Riscos" checked="indeterminate" onCheckedChange={() => {}} />);

    const box = screen.getByRole('checkbox', { name: 'Riscos' });
    expect(box).toHaveAttribute('aria-checked', 'mixed');
    expect(box).toHaveAttribute('data-state', 'indeterminate');
  });

  it('renders a second glyph whose SHAPE differs from the check, not merely its colour', () => {
    const { container } = render(
      <Checkbox aria-label="Riscos" checked="indeterminate" onCheckedChange={() => {}} />,
    );

    const { check, indeterminate } = glyphs(container);
    expect(indeterminate).not.toBeNull();
    expect(check).not.toBeNull();
    // Two distinct elements — a minus and a check — not one element retinted.
    expect(indeterminate).not.toBe(check);

    // Complementary visibility: the check hides in the indeterminate state,
    // the minus is hidden by default and shows only in it.
    expect(check?.getAttribute('class')).toContain(
      'group-data-[state=indeterminate]/checkbox-indicator:hidden',
    );
    expect(indeterminate?.getAttribute('class')).toContain('hidden');
    expect(indeterminate?.getAttribute('class')).toContain(
      'group-data-[state=indeterminate]/checkbox-indicator:block',
    );
  });

  it('marks the indicator itself indeterminate, which is what selects the glyph', () => {
    const { container } = render(
      <Checkbox aria-label="Riscos" checked="indeterminate" onCheckedChange={() => {}} />,
    );

    expect(container.querySelector('[data-slot="checkbox-indicator"]')).toHaveAttribute(
      'data-state',
      'indeterminate',
    );
  });

  it('resolves to fully checked when activated from the indeterminate state', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox aria-label="Riscos" checked="indeterminate" onCheckedChange={onCheckedChange} />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Riscos' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('supports the uncontrolled form too, which is why the glyph is chosen by data-state and not by a prop', () => {
    const { container } = render(<Checkbox aria-label="Riscos" defaultChecked="indeterminate" />);

    expect(screen.getByRole('checkbox', { name: 'Riscos' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
    expect(container.querySelector('[data-slot="checkbox-indicator"]')).toHaveAttribute(
      'data-state',
      'indeterminate',
    );
  });
});

describe('Checkbox — regression of the existing boolean call sites (T004)', () => {
  /*
   * Every current caller uses exactly this shape: a controlled boolean
   * `checked`, an `onCheckedChange` that narrows with `=== true`, an `id`
   * paired with a `<Label htmlFor>`, and sometimes `disabled`. The nine
   * files are listed in the delivery report; what they share is reproduced
   * here once, because they share one primitive.
   */

  it('renders no indicator at all while unchecked', () => {
    const { container } = render(
      <Checkbox aria-label="Somente meus" checked={false} onCheckedChange={() => {}} />,
    );

    const box = screen.getByRole('checkbox', { name: 'Somente meus' });
    expect(box).toHaveAttribute('aria-checked', 'false');
    expect(box).toHaveAttribute('data-state', 'unchecked');
    // Radix mounts the indicator only for checked/indeterminate, so neither
    // glyph is in the document — the added minus cannot leak into the
    // unchecked state.
    expect(container.querySelector('[data-slot="checkbox-indicator"]')).toBeNull();
    expect(glyphs(container).indeterminate).toBeNull();
    expect(glyphs(container).check).toBeNull();
  });

  it('renders the check — and only the check as the active glyph — while checked', () => {
    const { container } = render(
      <Checkbox aria-label="Somente meus" checked onCheckedChange={() => {}} />,
    );

    const box = screen.getByRole('checkbox', { name: 'Somente meus' });
    expect(box).toHaveAttribute('aria-checked', 'true');
    expect(box).toHaveAttribute('data-state', 'checked');
    expect(container.querySelector('[data-slot="checkbox-indicator"]')).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(glyphs(container).check).not.toBeNull();
    // The minus element exists in the markup but is `hidden` by its own
    // base class outside the indeterminate state.
    expect(glyphs(container).indeterminate?.getAttribute('class')).toContain('hidden');
  });

  it('still delivers a boolean true to onCheckedChange when toggled on', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Somente meus" checked={false} onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Somente meus' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('still delivers a boolean false to onCheckedChange when toggled off', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Somente meus" checked onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Somente meus' }));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('is still a focusable native button, so platform keyboard activation is unchanged', () => {
    function Harness(): React.JSX.Element {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          aria-label="Somente vencidos"
          checked={checked}
          onCheckedChange={(next) => setChecked(next === true)}
        />
      );
    }
    render(<Harness />);

    const box = screen.getByRole('checkbox', { name: 'Somente vencidos' });
    box.focus();
    expect(document.activeElement).toBe(box);
    // Radix renders a real `<button type="button">`: Space/Enter activation
    // is the browser's, not a hand-rolled keydown handler. jsdom does not
    // translate a synthetic Space keyup into a click, so activation itself
    // is asserted through the click path below — the element's nature is
    // what makes the keyboard path equivalent, and that is what is checked
    // here. `e2e/accessibility.spec.ts` exercises the real one.
    expect(box.tagName).toBe('BUTTON');
    expect(box).toHaveAttribute('type', 'button');

    fireEvent.click(box);
    expect(box).toHaveAttribute('aria-checked', 'true');
  });

  it('still honours disabled, firing no change and staying out of the tab order', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Permissão"
        checked={false}
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );

    const box = screen.getByRole('checkbox', { name: 'Permissão' });
    expect(box).toBeDisabled();
    fireEvent.click(box);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('still associates with a Label through htmlFor/id, the way every call site wires it', () => {
    render(
      <div>
        <Checkbox id="only-mine" checked={false} onCheckedChange={() => {}} />
        <label htmlFor="only-mine">Somente minhas ações</label>
      </div>,
    );

    expect(screen.getByRole('checkbox', { name: 'Somente minhas ações' })).toHaveAttribute(
      'id',
      'only-mine',
    );
  });

  it('still merges a caller className instead of replacing the primitive styling', () => {
    render(
      <Checkbox
        aria-label="Permissão"
        checked={false}
        className="mt-1"
        onCheckedChange={() => {}}
      />,
    );

    const box = screen.getByRole('checkbox', { name: 'Permissão' });
    expect(box.className).toContain('mt-1');
    expect(box.className).toContain('size-4');
  });
});
