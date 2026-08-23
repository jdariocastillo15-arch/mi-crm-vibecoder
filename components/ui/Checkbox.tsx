"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * La casilla de completar — parte de JES-58.
 *
 * El gesto que más veces se repite en el CRM. El círculo mide 24px porque así
 * lo pide el diseño, pero el botón que lo envuelve mide 44px: el objetivo
 * táctil no baja de ahí ni cuando el dibujo es pequeño.
 *
 * `aria-label` es obligatorio en el tipo, no opcional con un valor por defecto:
 * una casilla sin nombre es invisible para un lector de pantalla.
 */
export function Checkbox({
  marcado,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  marcado: boolean;
  onChange: () => void;
  "aria-label": string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={ariaLabel}
      onClick={onChange}
      className={cn(
        "-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full transition-colors",
          marcado
            ? "bg-primary text-on-primary"
            : "border-[1.5px] border-border-strong hover:border-primary",
        )}
      >
        {marcado && <Check size={14} strokeWidth={2.5} aria-hidden />}
      </span>
    </button>
  );
}
