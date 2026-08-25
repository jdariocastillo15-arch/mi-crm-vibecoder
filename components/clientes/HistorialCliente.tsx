"use client";

import { useQuery } from "convex/react";
import { Check, Mail, MessageSquare, Phone, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import {
  ESTADO_VENTA,
  type CanalInteraccion,
  type EstadoVenta,
} from "@/lib/constants";
import { construirHistorial, type EntradaHistorial } from "@/lib/historial";
import { fechaCorta, fechaRelativa, formatEuros } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Historial unificado de un cliente — implementa JES-64.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 280–308.
 *
 * "Ver el historial completo de un cliente en un solo lugar" era una de las
 * necesidades originales de Marta y Carlos, y el diseño la resuelve con UNA
 * línea de tiempo y no con tres listas: lo que importa de un cliente es la
 * secuencia —se le llamó, se le mandó propuesta, se cerró la venta—, y tres
 * listas separadas obligan a reconstruirla de cabeza.
 *
 * Pide sus tres consultas él mismo, como hace `SeguimientosPendientes`. La de
 * seguimientos es literalmente la misma llamada que hace esa tarjeta —misma
 * función, mismos argumentos—, así que Convex las resuelve con una sola
 * suscripción y esto no cuesta nada.
 */

const ICONO_CANAL: Record<CanalInteraccion, LucideIcon> = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  en_persona: Users,
};

/**
 * Colores del círculo y del importe, escritos enteros porque Tailwind busca las
 * clases leyendo el fichero.
 *
 * Ojo al importe de una oportunidad abierta: va en color de texto normal, NO en
 * el azul de su etiqueta. Lo dice el diseño (`VENTA_EST.amt`) y tiene sentido:
 * lo que sigue abierto todavía no es ni bueno ni malo, y teñirlo lo contaría
 * como un resultado.
 */
const CIRCULO_VENTA: Record<EstadoVenta, string> = {
  abierta: "bg-info-bg text-info",
  ganada: "bg-success-bg text-success",
  perdida: "bg-error-bg text-error",
};

const IMPORTE_VENTA: Record<EstadoVenta, string> = {
  abierta: "text-text",
  ganada: "text-success-text",
  perdida: "text-error-text",
};

const FILAS_FANTASMA = [0, 1, 2];

export function HistorialCliente({ clienteId }: { clienteId: Id<"clientes"> }) {
  const interacciones = useQuery(api.interacciones.listByCliente, { clienteId });
  const ventas = useQuery(api.ventas.listByCliente, { clienteId });
  const seguimientos = useQuery(api.seguimientos.listByCliente, { clienteId });

  const cargando =
    interacciones === undefined || ventas === undefined || seguimientos === undefined;

  return (
    <Card title="Historial">
      {cargando ? (
        // Rama propia mientras carga: escribir "Sin actividad todavía" antes de
        // saberlo sería afirmar lo contrario de lo normal. Misma lección de
        // JES-61.
        <div className="flex flex-col">
          {FILAS_FANTASMA.map((i) => (
            <div key={i} className="flex items-start gap-3 border-t border-border py-3">
              <Skeleton width={34} height={34} radius={9999} />
              <div className="flex flex-1 flex-col gap-2 pt-1">
                <Skeleton width="45%" height={13} />
                <Skeleton width="70%" height={11} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Lista entradas={construirHistorial(interacciones, ventas, seguimientos)} />
      )}
    </Card>
  );
}

function Lista({ entradas }: { entradas: EntradaHistorial[] }) {
  // Aquí sí es un estado vacío con icono, a diferencia de los seguimientos
  // pendientes: esta es la tarjeta grande, y una ficha recién creada se abre
  // justo en este hueco.
  if (entradas.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare size={28} strokeWidth={1.5} aria-hidden />}
        title="Sin actividad todavía"
        help="Anota una interacción o registra una venta para empezar el historial."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {entradas.map((entrada) => (
        <Fila key={entrada.clave} entrada={entrada} />
      ))}
    </div>
  );
}

function Fila({ entrada }: { entrada: EntradaHistorial }) {
  const venta = entrada.estado ? ESTADO_VENTA[entrada.estado] : null;

  const Icono =
    entrada.tipo === "venta"
      ? TrendingUp
      : entrada.tipo === "seguimiento"
        ? Check
        : ICONO_CANAL[entrada.canal ?? "llamada"];

  const circulo =
    entrada.estado !== undefined
      ? CIRCULO_VENTA[entrada.estado]
      : entrada.tipo === "seguimiento"
        ? "bg-primary-subtle text-primary"
        : "bg-surface-2 text-text-muted";

  return (
    <div className="flex items-start gap-3 border-t border-border py-3">
      {/* Decorativo: lo que dice el icono ya lo dice el título en texto. */}
      <span
        aria-hidden
        className={cn(
          "inline-flex size-[34px] shrink-0 items-center justify-center rounded-full",
          circulo,
        )}
      >
        <Icono size={18} strokeWidth={1.5} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-text">{entrada.titulo}</span>

        {venta && (
          <span className="inline-flex self-start py-0.5">
            <Badge tono={venta.tono}>{venta.label}</Badge>
          </span>
        )}

        {/* La nota se pinta entera y parte por palabras: es lo que se dijo, y
            recortarla con puntos suspensivos la haría inútil. */}
        {entrada.detalle && (
          <span className="text-[13px] break-words text-text-muted">
            {entrada.detalle}
          </span>
        )}

        {/* Vacía si el autor ya no está en el equipo. Ver `lib/historial.ts`. */}
        {entrada.autoria && (
          <span className="text-xs text-text-subtle">{entrada.autoria}</span>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-[3px]">
        {entrada.importe !== undefined && entrada.estado !== undefined && (
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums whitespace-nowrap",
              IMPORTE_VENTA[entrada.estado],
            )}
          >
            {formatEuros(entrada.importe)}
          </span>
        )}
        <span className="text-xs whitespace-nowrap text-text-subtle">
          {fechaRelativa(entrada.fecha)} · {fechaCorta(entrada.fecha)}
        </span>
      </div>
    </div>
  );
}
