"use client";

import { Overlay } from "@/components/ui/Overlay";

/**
 * El hueco de los overlays que todavía no toca construir.
 *
 * Las acciones rápidas de "Hoy" abren cuatro formularios, pero solo dos
 * pertenecen a esta fase. Los otros dos abren esto en vez de no hacer nada: la
 * tarjeta cumple su criterio de aceptación ("cada acceso abre su overlay") y
 * quien lo pulse ve qué falta y dónde está escrito, igual que en las pantallas
 * pendientes.
 *
 * Se borra junto con el issue que lo nombra.
 */
export function OverlayPorConstruir({
  abierto,
  onCerrar,
  titulo,
  issue,
  lineas,
  descripcion,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  issue: string;
  lineas: string;
  descripcion: string;
}) {
  return (
    <Overlay abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <p className="text-[15px] text-text-muted">{descripcion}</p>
      <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-text-subtle">Diseño</dt>
          <dd className="font-mono text-[13px] text-text">
            CRM Shell.dc.html · {lineas}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-text-subtle">Issue</dt>
          <dd className="text-text">{issue}</dd>
        </div>
      </dl>
    </Overlay>
  );
}
