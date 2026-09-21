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
  disabled = false,
  className,
}: {
  marcado: boolean;
  onChange: () => void;
  "aria-label": string;
  /**
   * Apaga la casilla: ni responde al puntero ni llama a `onChange`.
   *
   * Hace falta porque el gesto dispara una mutación y hoy nada impide tocarla
   * dos veces. Esta prop es la pieza; usarla para bloquear la mutación en vuelo
   * en `SeccionSeguimientos` y `SeguimientosPendientes` es tarea aparte.
   */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center",
        disabled && "cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full transition-colors",
          marcado
            ? "bg-primary text-on-primary"
            : "border-[1.5px] border-border-strong",
          // El hover solo tiene sentido si la casilla responde.
          !marcado && !disabled && "hover:border-primary",
          disabled && !marcado && "border-border",
          disabled && marcado && "bg-border-strong",
        )}
      >
        {marcado && <Check size={14} strokeWidth={2.5} aria-hidden />}
      </span>
    </button>
  );
}
