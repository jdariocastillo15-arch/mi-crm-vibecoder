"use client";

import { CalendarPlus, Pencil, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Acciones rápidas de la ficha — implementa parte de JES-53.
 * Diseño: CRM Shell.dc.html, líneas 255–259; estilos en la línea 1425.
 *
 * En móvil se apilan con el icono al lado del texto; en escritorio van en fila
 * con el icono encima. No es decoración: en móvil se usan con el pulgar y con
 * el cliente delante, así que la fila ancha se lee de un vistazo.
 */
export type AccionFicha = "interaccion" | "seguimiento" | "venta";

const ACCIONES: { clave: AccionFicha; label: string; icono: LucideIcon }[] = [
  { clave: "interaccion", label: "Registrar interacción", icono: Pencil },
  { clave: "seguimiento", label: "Programar seguimiento", icono: CalendarPlus },
  { clave: "venta", label: "Registrar venta", icono: TrendingUp },
];

export function AccionesFicha({
  onAccion,
}: {
  onAccion: (accion: AccionFicha) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 md:flex-row">
      {ACCIONES.map(({ clave, label, icono: Icono }) => (
        <button
          key={clave}
          type="button"
          onClick={() => onAccion(clave)}
          className="flex min-h-13 flex-row items-center justify-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-[15px] font-medium text-text shadow-xs transition-colors hover:border-border-strong hover:bg-surface-2 md:flex-1 md:flex-col md:justify-center md:gap-2 md:px-2.5 md:py-4 md:text-[13px]"
        >
          <Icono size={20} strokeWidth={1.5} aria-hidden className="text-primary" />
          {label}
        </button>
      ))}
    </div>
  );
}
