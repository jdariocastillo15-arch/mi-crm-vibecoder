"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { AVISOS } from "@/lib/constants";
import { clasificar, pendientesPorVencimiento, textoVencimiento } from "@/lib/seguimientos";
import { cn } from "@/lib/cn";

/**
 * Seguimientos pendientes de un cliente — implementa JES-61.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 262–280 y
 * 946–958 (`decPend`).
 *
 * Es la vista POR CLIENTE de lo que "Hoy" enseña por día. Sin ella habría que
 * salir a "Hoy" y buscar a este cliente entre los de todo el mundo, que es
 * justo el rodeo que este CRM existe para evitar.
 *
 * Trae su propia consulta en vez de recibir las filas por prop: es un ciclo de
 * datos aparte del cliente y no tiene por qué pasar por la ficha entera.
 */

/** Una fila tal y como la devuelve el servidor, ya con el nombre del responsable. */
type Seguimiento = FunctionReturnType<typeof api.seguimientos.listByCliente>[number];

export function SeguimientosPendientes({ clienteId }: { clienteId: Id<"clientes"> }) {
  const seguimientos = useQuery(api.seguimientos.listByCliente, { clienteId });
  const { mostrar, mostrarError } = useToast();

  // Se marca la fila como hecha en la caché en vez de sacarla de la lista: el
  // servidor va a devolver exactamente eso —la consulta trae también los
  // completados— y así el documento sigue estando cuando el historial de
  // JES-64 lo pida a esta misma consulta. Solo se toca `hecho`, que es el
  // campo por el que esta tarjeta filtra; el resto lo rellena el servidor un
  // instante después.
  const marcarHecho = useMutation(api.seguimientos.marcarHecho).withOptimisticUpdate(
    (localStore, { seguimientoId }) => {
      const actual = localStore.getQuery(api.seguimientos.listByCliente, { clienteId });
      if (actual === undefined) return;

      localStore.setQuery(
        api.seguimientos.listByCliente,
        { clienteId },
        actual.map((s) => (s._id === seguimientoId ? { ...s, hecho: true } : s)),
      );
    },
  );

  // Deshacer va sin actualización optimista, a diferencia de "Hoy". Allí hace
  // falta un mapa de copias a nivel de módulo para reinsertar la fila que ya se
  // había quitado; aquí la fila nunca se fue de la caché, así que basta con
  // esperar la vuelta del servidor para un gesto que además es poco frecuente.
  const deshacer = useMutation(api.seguimientos.deshacer);

  function completar(seguimiento: Seguimiento) {
    // Sin `await` antes del aviso: el cambio se ve al instante y el error, si
    // lo hay, llega después. Mismo trato que en "Hoy".
    const guardado = marcarHecho({ seguimientoId: seguimiento._id });

    mostrar(AVISOS.seguimientoCompletado, {
      label: "Deshacer",
      onClick: () => {
        deshacer({ seguimientoId: seguimiento._id }).catch((e: unknown) =>
          mostrarError(e instanceof Error ? e.message : "No se ha podido deshacer"),
        );
      },
    });

    guardado.catch((e: unknown) =>
      mostrarError(e instanceof Error ? e.message : "No se ha podido guardar"),
    );
  }

  return (
    <Card title="Seguimientos pendientes">
      {seguimientos === undefined ? (
        // Mientras carga NO se puede escribir "Sin seguimientos pendientes.":
        // sería afirmar algo que todavía no se sabe, y encima lo contrario de
        // lo normal.
        <div className="flex flex-col gap-3 py-1.5">
          <Skeleton width="55%" height={13} />
          <Skeleton width="40%" height={13} />
        </div>
      ) : (
        <Lista
          pendientes={pendientesPorVencimiento(seguimientos)}
          onCompletar={completar}
        />
      )}
    </Card>
  );
}

function Lista({
  pendientes,
  onCompletar,
}: {
  pendientes: Seguimiento[];
  onCompletar: (seguimiento: Seguimiento) => void;
}) {
  // Una línea suelta, no un `EmptyState` con icono: el diseño reserva ese trato
  // para el historial, que es la tarjeta grande de abajo.
  if (pendientes.length === 0) {
    return <p className="py-1.5 text-sm text-text-muted">Sin seguimientos pendientes.</p>;
  }

  return (
    <div className="flex flex-col">
      {pendientes.map((seguimiento) => (
        <Fila
          key={seguimiento._id}
          seguimiento={seguimiento}
          onCompletar={() => onCompletar(seguimiento)}
        />
      ))}
    </div>
  );
}

function Fila({
  seguimiento,
  onCompletar,
}: {
  seguimiento: Seguimiento;
  onCompletar: () => void;
}) {
  // La etiqueta aquí es binaria, a diferencia de "Hoy": lo que vence hoy sale
  // como "Pendiente". No es un descuido — en "Hoy" la cabecera de sección ya
  // dice de qué grupo es cada fila, y aquí no hay secciones.
  const atrasado = clasificar(seguimiento.vence) === "atrasado";

  return (
    <div className="flex items-center gap-3 py-[11px]">
      <Checkbox
        marcado={false}
        aria-label={`Marcar como hecho: ${seguimiento.accion}`}
        onChange={onCompletar}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium text-text">
          {seguimiento.accion}
        </span>
        <span
          className={cn("text-[13px]", atrasado ? "text-error-text" : "text-text-muted")}
        >
          {textoVencimiento(seguimiento.vence)}
        </span>
      </div>

      {/* Puede faltar: borrar a alguien del equipo deja vivos sus seguimientos.
          Sin nombre no se dibuja un avatar ni se inventa uno.

          Sin envoltorio: `Avatar` ya pone el `title` con el nombre y ya trae su
          propio `shrink-0`, así que envolverlo solo duplicaría el atributo. */}
      {seguimiento.responsableNombre && (
        <Avatar name={seguimiento.responsableNombre} size={22} variant="neutral" />
      )}

      <span className="shrink-0">
        <Badge tono={atrasado ? "error" : "warning"}>
          {atrasado ? "Atrasado" : "Pendiente"}
        </Badge>
      </span>
    </div>
  );
}
