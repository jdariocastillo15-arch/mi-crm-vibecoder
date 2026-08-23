"use client";

import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { ESTADO_CLIENTE } from "@/lib/constants";
import { textoVencimiento, type Seccion } from "@/lib/seguimientos";
import { cn } from "@/lib/cn";

/** Lo que devuelve `listPendientes`, ya cruzado con cliente y responsable. */
export type FilaSeguimiento = FunctionReturnType<
  typeof api.seguimientos.listPendientes
>[number];

const SECCIONES: Record<
  Seccion,
  { titulo: string; destacada: boolean; badge: { texto: string; tono: "error" | "neutral" } | null }
> = {
  atrasado: {
    titulo: "Atrasados",
    destacada: true,
    badge: { texto: "Atrasado", tono: "error" },
  },
  hoy: {
    titulo: "Para hoy",
    destacada: false,
    badge: { texto: "Hoy", tono: "neutral" },
  },
  // Las próximas no llevan distintivo a propósito: la cabecera ya dice
  // "Próximas" y el subtítulo ya dice cuándo vence. Un tercer indicador en cada
  // fila futura sería ruido que no informa de nada.
  proxima: { titulo: "Próximas", destacada: false, badge: null },
};

export function SeccionSeguimientos({
  seccion,
  items,
  onCompletar,
}: {
  seccion: Seccion;
  items: FilaSeguimiento[];
  onCompletar: (fila: FilaSeguimiento) => void;
}) {
  if (items.length === 0) return null;
  const cfg = SECCIONES[seccion];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-xs",
        cfg.destacada && "border-t-[3px] border-t-error",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-2 px-4.5 py-3.5",
          cfg.destacada && "bg-error-bg",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            cfg.destacada ? "bg-error" : "bg-text-subtle",
          )}
        />
        <h2
          className={cn(
            "flex-1 text-[13px] font-semibold tracking-caps uppercase",
            cfg.destacada ? "text-error-text" : "text-text-muted",
          )}
        >
          {cfg.titulo}
        </h2>
        <span
          className={cn(
            "font-mono text-[13px] font-semibold",
            cfg.destacada ? "text-error-text" : "text-text-subtle",
          )}
        >
          {items.length}
        </span>
      </header>

      <div className="px-4.5 pb-2">
        {items.map((fila) => (
          <Fila
            key={fila._id}
            fila={fila}
            badge={cfg.badge}
            atrasado={seccion === "atrasado"}
            onCompletar={() => onCompletar(fila)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Una fila, SIN HTML interactivo anidado.
 *
 * El diseño pide que toda la fila lleve a la ficha y que la casilla no. Meter
 * un <button> dentro de un <Link> sería HTML inválido y rompería el teclado, y
 * `stopPropagation` no arregla ni la semántica ni la navegación. Van como
 * hermanos: el enlace estira su área de pulsación con un pseudo-elemento
 * (`after:absolute after:inset-0`) y la casilla se levanta por encima con
 * `z-10`. Resultado: dos paradas de tabulación limpias y ni un solo
 * `stopPropagation`.
 */
function Fila({
  fila,
  badge,
  atrasado,
  onCompletar,
}: {
  fila: FilaSeguimiento;
  badge: { texto: string; tono: "error" | "neutral" } | null;
  atrasado: boolean;
  onCompletar: () => void;
}) {
  const estado = ESTADO_CLIENTE[fila.cliente.estado];

  return (
    <div className="relative flex items-center gap-1.5 border-t border-border py-2 first:border-t-0">
      <Checkbox
        marcado={false}
        aria-label={`Marcar como hecho: ${fila.accion}`}
        onChange={onCompletar}
        className="relative z-10"
      />

      <Link
        href={`/clientes/${fila.clienteId}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-0.5 after:absolute after:inset-0 after:content-['']"
      >
        <Avatar name={fila.cliente.nombre} size={40} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-text">
              {fila.cliente.nombre}
            </span>
            <Badge tono={estado.tono}>{estado.label}</Badge>
          </span>

          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
              {fila.accion}
            </span>
            {/* Puede faltar: borrar a alguien del equipo deja vivos sus
                seguimientos. Sin nombre no se inventa un avatar. */}
            {fila.responsableNombre && (
              <span title={fila.responsableNombre} className="shrink-0">
                <Avatar name={fila.responsableNombre} size={20} variant="neutral" />
              </span>
            )}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          {badge && <Badge tono={badge.tono}>{badge.texto}</Badge>}
          <span
            className={cn(
              "text-xs whitespace-nowrap",
              atrasado ? "text-error-text" : "text-text-subtle",
            )}
          >
            {textoVencimiento(fila.vence)}
          </span>
        </span>
      </Link>
    </div>
  );
}
