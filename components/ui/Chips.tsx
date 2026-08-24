"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Etiquetas seleccionables — parte de JES-41.
 *
 * Nace con dos modos porque dos formularios las necesitan con comportamientos
 * distintos, y forzar uno solo dejaría el otro mal:
 *
 * · Responsable de un seguimiento (JES-60): obligatorio, siempre hay uno.
 * · Canal de origen de un cliente (JES-52): opcional, y volver a pulsar la
 *   activa la quita.
 *
 * La accesibilidad también cambia entre los dos, y no es un detalle: un grupo
 * del que no se puede salir es un `radiogroup`, y uno que se puede vaciar son
 * botones de dos estados. Anunciarlos igual sería mentirle al lector de
 * pantalla.
 */
export type OpcionChip<T extends string> = { valor: T; etiqueta: string };

export function Chips<T extends string>({
  label,
  opciones,
  valor,
  onChange,
  permitirVaciar = false,
  error,
}: {
  label: string;
  opciones: OpcionChip<T>[];
  valor: T | null;
  onChange: (valor: T | null) => void;
  /** true → se puede quedar sin selección. false → siempre hay una. */
  permitirVaciar?: boolean;
  error?: string | null;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const indiceActivo = Math.max(
    0,
    opciones.findIndex((o) => o.valor === valor),
  );

  /** Flechas: solo en el modo obligatorio, donde mover el foco es mover la selección. */
  function alPulsarTecla(e: React.KeyboardEvent, indice: number) {
    if (permitirVaciar) return;
    const salto =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (salto === 0) return;
    e.preventDefault();
    const siguiente = (indice + salto + opciones.length) % opciones.length;
    onChange(opciones[siguiente].valor);
    refs.current[siguiente]?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-text">
        {label}
      </span>

      <div
        role={permitirVaciar ? "group" : "radiogroup"}
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-error` : undefined}
        className="flex flex-wrap gap-2"
      >
        {opciones.map((opcion, indice) => {
          const activa = opcion.valor === valor;
          return (
            <button
              key={opcion.valor}
              ref={(el) => {
                refs.current[indice] = el;
              }}
              type="button"
              // Un grupo que no se puede vaciar es un radiogroup; uno que sí,
              // son botones de dos estados.
              role={permitirVaciar ? undefined : "radio"}
              aria-checked={permitirVaciar ? undefined : activa}
              aria-pressed={permitirVaciar ? activa : undefined}
              // Tabulación itinerante: el grupo entero es una sola parada.
              tabIndex={permitirVaciar || indice === indiceActivo ? 0 : -1}
              onKeyDown={(e) => alPulsarTecla(e, indice)}
              onClick={() =>
                onChange(activa && permitirVaciar ? null : opcion.valor)
              }
              className={cn(
                "rounded-md border px-3.5 py-2.5 text-sm font-medium transition-colors",
                activa
                  ? "border-primary bg-primary-subtle text-primary"
                  : "border-border-strong bg-surface text-text-muted hover:bg-surface-2",
              )}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>

      {error && (
        <p id={`${id}-error`} className="text-[13px] text-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
