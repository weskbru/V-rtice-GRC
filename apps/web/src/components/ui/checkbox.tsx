"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, MinusIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary dark:data-[state=indeterminate]:bg-primary",
        className
      )}
      {...props}
    >
      {/*
       * D-15: partial selection is a third, genuinely distinct state, not a
       * dimmer "checked". Radix already models it — `checked="indeterminate"`
       * emits `aria-checked="mixed"` on the root and `data-state=
       * "indeterminate"` on both root and indicator — but the generated
       * primitive rendered the SAME `CheckIcon` for it, so "all of this
       * module" and "some of this module" were indistinguishable to sighted
       * and screen-magnifier users alike. A minus is the platform-conventional
       * glyph and, unlike a tint change, differs from the check in SHAPE:
       * CLAUDE.md §18.8/NFR-004 — colour is never the only signal.
       *
       * Which glyph shows is decided by the indicator's own `data-state`, in
       * CSS, rather than by reading a `checked` prop here: that keeps
       * uncontrolled checkboxes (`defaultChecked`) correct too, and cannot
       * drift from the state Radix actually reports to assistive technology.
       * `display: none` on the inactive glyph keeps it out of layout AND out
       * of the accessibility tree.
       */}
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group/checkbox-indicator grid place-content-center text-current transition-none"
      >
        <CheckIcon
          data-slot="checkbox-check-glyph"
          className="size-3.5 group-data-[state=indeterminate]/checkbox-indicator:hidden"
        />
        <MinusIcon
          data-slot="checkbox-indeterminate-glyph"
          className="hidden size-3.5 group-data-[state=indeterminate]/checkbox-indicator:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
