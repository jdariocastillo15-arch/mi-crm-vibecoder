"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Botón — implementa parte de JES-41.
 * Una sola acción primaria por vista: el verde se gana su lugar.
 */

type Variante = "primary" | "secondary" | "ghost" | "destructive";
type Tamano = "default" | "compact";

const VARIANTES: Record<Variante, string> = {
  primary:
    "bg-primary text-on-primary border border-transparent font-semibold hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-surface text-text border border-border-strong font-medium hover:bg-surface-2",
  ghost:
    "bg-transparent text-text-muted border border-transparent font-medium hover:bg-surface-2",
  destructive:
    "bg-error text-white border border-transparent font-semibold hover:brightness-90",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variante;
  size?: Tamano;
  loading?: boolean;
  iconLeft?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = "secondary",
  size = "default",
  loading = false,
  iconLeft,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const inactivo = disabled || loading;

  return (
    <button
      {...props}
      disabled={inactivo}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-5 text-[15px] transition-colors",
        size === "default" ? "h-12" : "h-11",
        fullWidth && "w-full",
        VARIANTES[variant],
        inactivo &&
          "cursor-not-allowed border-border bg-surface-2 text-text-subtle shadow-none hover:bg-surface-2 hover:brightness-100",
        className,
      )}
    >
      {loading && <Spinner />}
      {!loading && iconLeft}
      {children}
    </button>
  );
}

/** Indicador de progreso: borde girando, 16px. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 shrink-0 animate-vibe-spin rounded-full border-2 border-current/40 border-t-current",
        className,
      )}
    />
  );
}
