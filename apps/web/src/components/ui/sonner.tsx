"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      {/*
        Second episode of the same defect, and this time the colour tokens
        below are not the cause. sonner animates this element's own
        `opacity` from 0 to 1 over 400ms on mount (its injected CSS: base
        rule `opacity: 0`, `transition: ... opacity 400ms ...`, flipped to
        `opacity: 1` by its own `[data-mounted='true']`). `opacity` is a
        compositing property: for as much of that 400ms as the toast is on
        screen, its text and background are genuinely blended toward the
        page background (`--background`, #f5f7fa in light mode), not just
        visually — `getComputedStyle` still reports the correct, fully
        opaque `color`/`background-color` the whole time, but a renderer (a
        browser painting pixels, or axe-core's color-contrast check, which
        walks ancestor opacity to compute the colour actually on screen)
        sees the blended, reduced-contrast result.

        Reproduced twice locally against this exact toast, `[data-sonner-
        toast]` scanned with `@axe-core/playwright` immediately after
        Playwright's `toBeVisible()` resolved (which does not wait for CSS
        transitions to finish): fgColor #3c8f70 on bgColor #f0faf7 (3.68:1)
        one run, fgColor #70ad97 on bgColor #f2f9f8 (2.42:1) another — two
        different pairs on two different runs, both algebraically equal to
        this toast's real, correct light token pair (--status-success-fg
        #10754f on --status-success-bg #effbf6, 5.38:1, see globals.css)
        alpha-blended over #f5f7fa at, respectively, ~80% and ~58% opacity:
        two different snapshots of the same 400ms fade, not two different
        colours. The token pair itself was never wrong, which is what the
        comment below already got right — it just never accounted for the
        toast being scanned mid-animation.

        The <style> block removes `opacity` from this element's own CSS
        transition, so the mount-time opacity change is instant instead of
        animated; the slide (`transform`), `height` and `box-shadow`
        transitions are untouched, so the toast still animates in — it just
        never spends part of that 400ms at less than full, verified
        contrast, however fast or slow an observer (human or axe) looks.
      */}
      <style>{`
        [data-sonner-toast] {
          transition-property: transform, height, box-shadow;
          transition-duration: 400ms, 400ms, 200ms;
        }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        icons={{
          success: <CircleCheckIcon className="size-4" />,
          info: <InfoIcon className="size-4" />,
          warning: <TriangleAlertIcon className="size-4" />,
          error: <OctagonXIcon className="size-4" />,
          loading: <Loader2Icon className="size-4 animate-spin" />,
        }}
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)",
            // `richColors` (feedback-provider.tsx) makes `sonner` apply its
            // OWN hardcoded per-severity palette instead of these tokens —
            // and that palette fails WCAG AA in light mode: measured with
            // `@axe-core/playwright` against the real rendered toast, title
            // and description text against background is success 4.25:1,
            // warning 3.07:1, error 4.34:1, info 4.35:1 (all below the 4.5:1
            // normal-text threshold; dark mode's own hardcoded values happen
            // to already clear it). These six variables are the exact ones
            // `richColors` reads (`sonner`'s injected CSS, `[data-rich-colors=
            // true][data-sonner-toast][data-type=X]`), so pointing them at
            // the design system's own pre-verified `--status-*` tokens
            // (`packages/design-system/src/styles/globals.css`; every pair
            // documented ≥4.5:1 in both themes right next to its hex value —
            // light: success 5.38:1, warning 5.92:1, danger 10.46:1, info
            // 9.33:1; dark: success 8.30:1, warning 8.61:1, danger 8.65:1,
            // info 8.77:1 — and already what every status pill/badge in the
            // product uses) fixes every severity in both themes at once from
            // a single source of truth, rather than hand-picking new colours
            // that would drift from the rest of the product (CLAUDE.md
            // §18.3). This part of the fix was correct the first time — the
            // `<style>` block above addresses a second, independent defect
            // in the same component (the mount animation transiently
            // diluting these already-correct colours), not this one.
            "--success-bg": "var(--status-success-bg)",
            "--success-border": "var(--status-success-border)",
            "--success-text": "var(--status-success-fg)",
            "--info-bg": "var(--status-info-bg)",
            "--info-border": "var(--status-info-border)",
            "--info-text": "var(--status-info-fg)",
            "--warning-bg": "var(--status-warning-bg)",
            "--warning-border": "var(--status-warning-border)",
            "--warning-text": "var(--status-warning-fg)",
            "--error-bg": "var(--status-danger-bg)",
            "--error-border": "var(--status-danger-border)",
            "--error-text": "var(--status-danger-fg)",
          } as React.CSSProperties
        }
        {...props}
      />
    </>
  )
}

export { Toaster }
