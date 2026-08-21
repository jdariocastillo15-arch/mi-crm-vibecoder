"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Botón de solo icono — implementa parte de JES-41.
 * `aria-label` es obligatorio: sin él, quien use un lector de pantalla no sabe
 * qué hace el botón. Por eso está en el tipo y no es opcional.
 */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  "aria-label": string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "default" | "compact";
  children: ReactNode;
}

const VARIANTES = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text-muted hover:bg-surface-2",
  destructive: "bg-transparent text-error hover:bg-error-bg",
} as const;

export function IconButton({
  variant = "ghost",
  size = "default",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors",
        size === "default" ? "size-12" : "size-11",
        VARIANTES[variant],
        props.disabled && "cursor-not-allowed text-text-subtle hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}
