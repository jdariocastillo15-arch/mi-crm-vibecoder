"use client";

import { Pencil, Plus, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Panel de acciones rápidas — implementa JES-57.
 *
 * Registrar cualquier cosa sin tener que buscar antes al cliente: Carlos cuelga
 * el teléfono y apunta lo que acaba de pasar en dos toques.
 *
 * "Nueva tarea" es la acción principal, y es la única con el círculo en verde
 * sólido. Las otras tres van en verde suave.
 */
export type AccionRapida = "tarea" | "interaccion" | "venta" | "cliente";

const ACCIONES: { clave: AccionRapida; label: string; icono: LucideIcon; principal: boolean }[] = [
  { clave: "tarea", label: "Nueva tarea", icono: Plus, principal: true },
  { clave: "interaccion", label: "Anotar interacción", icono: Pencil, principal: false },
  { clave: "venta", label: "Registrar venta", icono: TrendingUp, principal: false },
  { clave: "cliente", label: "Nuevo cliente", icono: Users, principal: false },
];

export function AccionesRapidas({
  onAccion,
}: {
  onAccion: (accion: AccionRapida) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {ACCIONES.map(({ clave, label, icono: Icono, principal }) => (
        <button
          key={clave}
          type="button"
          onClick={() => onAccion(clave)}
          className="flex min-h-15 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left shadow-xs transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
              principal
                ? "bg-primary text-on-primary"
                : "bg-primary-subtle text-primary",
            )}
          >
            <Icono size={18} strokeWidth={1.5} aria-hidden />
          </span>
          <span className="text-[15px] leading-tight font-medium text-text">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
