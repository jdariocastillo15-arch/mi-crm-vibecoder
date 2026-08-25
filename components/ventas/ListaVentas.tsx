"use client";

import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { ESTADO_VENTA } from "@/lib/constants";
import {
  CIRCULO_VENTA,
  IMPORTE_VENTA,
  VACIO_POR_FILTRO,
  type FiltroVenta,
} from "@/lib/ventas";
import { fechaCorta, formatEuros } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Listado de operaciones de la pantalla "Ventas" — implementa JES-67.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 380–408.
 *
 * El detalle de qué está en marcha y qué se cerró, con un camino directo desde
 * cada operación a la ficha de su cliente: en un negocio de dos, mirar la cifra
 * y no poder llegar a quién hay detrás es media pantalla.
 *
 * Recibe las filas YA filtradas y ordenadas. Las reglas viven en
 * `lib/ventas.ts`, donde se pueden leer sin JSX alrededor.
 */

/** Una venta tal y como la devuelve el servidor, ya con el nombre del cliente. */
type Venta = FunctionReturnType<typeof api.ventas.list>[number];

export function ListaVentas({
  ventas,
  filtro,
}: {
  ventas: Venta[];
  /** Solo para el estado vacío: cada filtro tiene su propio mensaje. */
  filtro: FiltroVenta;
}) {
  if (ventas.length === 0) {
    return (
      <Card padding={false}>
        <EmptyState
          icon={<TrendingUp size={28} strokeWidth={1.5} aria-hidden />}
          title={VACIO_POR_FILTRO[filtro]}
          help="Las ventas se registran desde la ficha de cada cliente."
        />
      </Card>
    );
  }

  return (
    <Card padding={false}>
      {ventas.map((venta) => (
        <Fila key={venta._id} venta={venta} />
      ))}
    </Card>
  );
}

function Fila({ venta }: { venta: Venta }) {
  const estado = ESTADO_VENTA[venta.estado];

  const contenido = (
    <>
      {/* Decorativo: el estado lo dice la etiqueta, en texto. */}
      <span
        aria-hidden
        className={cn(
          "inline-flex size-[34px] shrink-0 items-center justify-center rounded-full",
          CIRCULO_VENTA[venta.estado],
        )}
      >
        <TrendingUp size={18} strokeWidth={1.5} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[15px] font-medium text-text">
          {venta.concepto}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0">
            <Badge tono={estado.tono}>{estado.label}</Badge>
          </span>
          {/* El guion es el caso imposible de hoy: `clientes` no tiene borrado.
              Ver el comentario de `ventas.list`. */}
          <span className="truncate text-[13px] text-text-muted">
            {venta.clienteNombre ?? "—"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-[3px]">
        <span
          className={cn(
            "font-mono text-[15px] font-semibold tabular-nums whitespace-nowrap",
            IMPORTE_VENTA[venta.estado],
          )}
        >
          {formatEuros(venta.importe)}
        </span>
        <span className="text-xs whitespace-nowrap text-text-subtle">
          {fechaCorta(venta.fecha)}
        </span>
      </div>
    </>
  );

  // Sin cliente no hay a dónde ir, así que la fila deja de ser interactiva en
  // vez de enlazar a una ficha que dirá "este cliente no existe".
  if (venta.clienteNombre === null) {
    return <div className={clases(false)}>{contenido}</div>;
  }

  // Un ENLACE de verdad, no un botón que navega: así funcionan el clic central,
  // "abrir en pestaña nueva" y el menú contextual, y un lector de pantalla lo
  // anuncia como enlace. Es la misma corrección que se hizo en `ListRow`.
  return (
    <Link href={`/clientes/${venta.clienteId}`} className={clases(true)}>
      {contenido}
    </Link>
  );
}

function clases(interactiva: boolean): string {
  return cn(
    "flex w-full items-center gap-3 border-b border-border px-[18px] py-[13px] text-left last:border-b-0",
    interactiva && "cursor-pointer transition-colors hover:bg-surface-2",
    // El anillo de foco del sistema es una sombra que sobresale 4px, y la
    // tarjeta que envuelve la lista recorta lo que se salga de ella. Se cambia
    // por un contorno hacia dentro, que no se puede recortar. Igual que en
    // `ListRow`.
    interactiva &&
      "focus-visible:shadow-none focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-3px]",
  );
}

const FILAS_FANTASMA = [0, 1, 2, 3];

/**
 * La espera, con la forma de lo que va a llegar.
 *
 * Rama propia y no un listado vacío: escribir "Sin ventas registradas" antes de
 * saberlo sería afirmar lo contrario de lo normal, y encima cambiaría delante de
 * los ojos. Misma lección de JES-61 y JES-64.
 */
export function ListaVentasCargando() {
  return (
    <Card padding={false}>
      {FILAS_FANTASMA.map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-[18px] py-[13px] last:border-b-0"
        >
          <Skeleton width={34} height={34} radius={9999} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton width="42%" height={13} />
            <Skeleton width="58%" height={11} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton width={62} height={13} />
            <Skeleton width={38} height={11} />
          </div>
        </div>
      ))}
    </Card>
  );
}
