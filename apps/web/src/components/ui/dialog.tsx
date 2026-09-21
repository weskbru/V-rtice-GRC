"use client"

import * as React from "react"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { common } from "@/lib/messages/common"
import { useDialogFocusRestore } from "@pharos/design-system/components"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  // T203 finding: every dialog in this app is opened from a plain trigger
  // `<Button>`, never Radix's own `<Dialog.Trigger>` (confirmed across
  // every call site — `risk-lifecycle-actions.tsx`, `approval-dialogs.tsx`,
  // every admin create/edit dialog). `@radix-ui/react-dialog`'s MODAL
  // content (`DialogContentModal`) hard-codes its `onCloseAutoFocus` to
  // `event.preventDefault(); context.triggerRef.current?.focus()` —
  // unconditionally, regardless of whether a `Dialog.Trigger` was ever
  // rendered. `preventDefault()` also discards the underlying
  // `FocusScope`'s own generic "restore whatever had focus before the
  // dialog opened" fallback (it only runs `if
  // (!unmountEvent.defaultPrevented)`), so with no registered trigger,
  // NOTHING is restored: focus silently falls back to `<body>` on every
  // close (Escape, the X button, or a Cancel button) — reproduced directly
  // against a production build, not merely inferred. Capturing and
  // restoring focus ourselves here, ahead of Radix's own handler (composed
  // handlers run in the order listed — ours below runs first and stops
  // Radix's with `preventDefault()`), fixes every dialog built on this one
  // component without touching a single call site.
  //
  // D-15 update: the capture used to happen in `onOpenAutoFocus`, which
  // Radix fires AFTER commit. Two patterns defeated it there: (a) a native
  // `autoFocus` on a field inside the dialog moves focus onto that field
  // during commit, before `onOpenAutoFocus` runs, so it was the field —
  // not the real trigger — that got captured, and it no longer exists once
  // the dialog closes; (b) a dialog opened from a `DropdownMenuItem`'s
  // `onSelect` captured the menu item, which unmounts during the menu's
  // own exit animation. `useDialogFocusRestore` (design system, shared with
  // `ConfirmDialog`) fixes both: it captures during React's RENDER phase —
  // strictly before any commit-phase `autoFocus` — via `FocusRestoreAnchor`
  // mounted as the content's first child, and resolves a captured menu item
  // to its trigger via the menu's own `aria-labelledby`.
  const { FocusRestoreAnchor, restoreTargetRef, handleCloseAutoFocus } = useDialogFocusRestore()

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid max-h-[90vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={(event) => {
          handleCloseAutoFocus(event)
          onCloseAutoFocus?.(event)
        }}
        {...props}
      >
        <FocusRestoreAnchor restoreTargetRef={restoreTargetRef} />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">{common.dialog.closeLabel}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{common.dialog.closeLabel}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
