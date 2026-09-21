import { AlertCircle } from 'lucide-react';
import { useId } from 'react';

import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

/**
 * The accessibility wiring a control needs from its enclosing `FormField`:
 * the id to render on the actual input/trigger element, the
 * `aria-describedby` value covering both the description and any error
 * text, and whether `aria-invalid` should be set. Passed to `children` as a
 * render prop rather than injected via a React context or a cloned element,
 * so `FormField` stays usable with *any* control — a native `<input>`, a
 * `<textarea>`, a Radix `Select` trigger, a future rich control — without
 * requiring that control to be `react-hook-form`-aware. This package must
 * never depend on `react-hook-form` (dependencies only ever point from
 * `apps/web` into the design system, never the other way around); wiring
 * `react-hook-form`'s `register`/`Controller` output onto these props is the
 * caller's job.
 */
export interface FormFieldRenderProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean;
}

export interface FormFieldProps {
  /** Stable id for the control. Auto-generated when omitted — supply one only when something else outside this field needs to reference it. */
  id?: string;
  /** Visible field label. Always rendered as text — never an icon-only or placeholder-only label. */
  label: string;
  /**
   * Marks the field as required. Rendered as a visible `*` plus a
   * screen-reader-only "(obrigatório)" so the indication never depends on
   * color alone (SC-012) — the `*` glyph itself is a non-color, non-decorative
   * signal, unlike e.g. a red label with no textual marker.
   */
  required?: boolean;
  /** Supporting help text shown under the control, wired into `aria-describedby` even when there is no error. */
  description?: string;
  /** Field-level validation message. When present, replaces nothing — it renders alongside the description and is announced via `role="alert"`. */
  error?: string;
  /**
   * Visible marker rendered next to the label when the field is NOT
   * required, e.g. `"(opcional)"` — the platform-wide required/optional
   * convention (CLAUDE.md §18, "Forms"): required is a non-color `*` glyph
   * (see `required` above), optional is this explicit text, so neither
   * state depends on the other being silently inferred. Never hardcoded
   * here — like every other user-facing string in this package (D-10), the
   * caller supplies its own pt-BR catalog entry; omit it to render no
   * marker at all (a caller's existing forms keep behaving exactly as
   * before this prop existed). Ignored when `required` is `true`.
   */
  optionalIndicator?: string;
  className?: string;
  /** Render prop receiving the id/aria wiring this field computed — see `FormFieldRenderProps`. */
  children: (field: FormFieldRenderProps) => ReactNode;
}

/**
 * Platform-wide form field wrapper (T093, FR-045, SC-012). This is the
 * label/control/help-text/error vocabulary every module's forms use: a
 * visible label associated with its control via `htmlFor`/`id`, a required
 * indicator that is never color-only, and a description/error region wired
 * through `aria-describedby` so assistive technology announces both
 * together with the control, exactly per WCAG 1.3.1 / 4.1.2.
 *
 * `FormField` itself renders no `<input>` — it owns only the field's
 * accessible structure. Compose it with any control:
 *
 * ```tsx
 * <FormField label="Título" required error={errors.title?.message}>
 *   {(field) => <Input {...field} {...register('title')} />}
 * </FormField>
 * ```
 */
export function FormField({
  id,
  label,
  required = false,
  description,
  error,
  optionalIndicator,
  className,
  children,
}: FormFieldProps): React.JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="ml-0.5 text-status-danger-fg">
                *
              </span>
              <span className="sr-only"> (obrigatório)</span>
            </>
          ) : null}
        </label>
        {/* Rendered OUTSIDE the <label> element on purpose — its accessible
            name comes from the label's own text content per the native
            label/control association algorithm, so a caller matching this
            field by its exact `label` text (e.g. `getByLabel('Categoria')`)
            keeps working whether or not an optional marker is shown. */}
        {!required && optionalIndicator ? (
          <span className="text-xs font-normal text-muted-foreground">{optionalIndicator}</span>
        ) : null}
      </div>

      {children({
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
      })}

      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-medium text-status-danger-fg"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
