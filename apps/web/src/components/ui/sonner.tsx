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
