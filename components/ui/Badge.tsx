import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tono } from "@/lib/constants";

/**
 * Pill de estado — implementa parte de JES-41.
 * Siempre lleva texto: ningún estado se comunica solo con color (JES-73).
 */

const TONOS: Record<Tono, { fondo: string; texto: string; punto: string }> = {
  success: { fondo: "bg-success-bg", texto: "text-success-text", punto: "bg-success" },
  warning: { fondo: "bg-warning-bg", texto: "text-warning-text", punto: "bg-warning" },
  error: { fondo: "bg-error-bg", texto: "text-error-text", punto: "bg-error" },
  info: { fondo: "bg-info-bg", texto: "text-info-text", punto: "bg-info" },
  primary: { fondo: "bg-primary-subtle", texto: "text-primary", punto: "bg-primary" },
  neutral: { fondo: "bg-surface-2", texto: "text-text-muted", punto: "bg-text-subtle" },
};

export function Badge({
  tono = "neutral",
  dot = true,
  className,
  children,
}: {
  tono?: Tono;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = TONOS[tono];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[13px] font-medium whitespace-nowrap",
        t.fondo,
        t.texto,
        className,
      )}
    >
      {dot && <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", t.punto)} />}
      {children}
    </span>
  );
}
