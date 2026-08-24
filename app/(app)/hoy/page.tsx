"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, SkeletonRow } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import {
  AccionesRapidas,
  type AccionRapida,
} from "@/components/hoy/AccionesRapidas";
import {
  SeccionSeguimientos,
  type FilaSeguimiento,
} from "@/components/hoy/SeccionSeguimientos";
import { OverlayNuevaTarea, type BorradorTarea } from "@/components/hoy/OverlayNuevaTarea";
import { OverlayNuevoCliente } from "@/components/hoy/OverlayNuevoCliente";
import { OverlayPorConstruir } from "@/components/ui/OverlayPorConstruir";
import { AVISOS } from "@/lib/constants";
import { fechaLarga, hoy, sumarDias } from "@/lib/format";
import { agruparParaHoy } from "@/lib/seguimientos";

/**
 * "Hoy" — implementa JES-56, JES-57 y JES-58.
 *
 * La pantalla con la que se abre la aplicación. Responde a una sola pregunta:
 * a quién tengo que contactar hoy y qué se me ha pasado de fecha.
 */

type QueOverlay = null | AccionRapida;

/**
 * Copia de la fila que se quita al completar, para poder devolverla si se
 * deshace. Vive fuera del componente a propósito: el actualizador optimista se
 * construye durante el render, así que leer un `useRef` desde dentro es
 * exactamente lo que React desaconseja. Esto no es estado de pintura, es un
 * apunte pasajero.
 *
 * Se rellena DENTRO del actualizador, que Convex ejecuta de forma síncrona, así
 * que la copia sale de la caché y no de unas props que podrían ir un render por
 * detrás. Es solo pintura: Convex la descarta en cuanto contesta el servidor, y
 * la regla de verdad —quién puede deshacer— vive en `convex/seguimientos.ts`.
 */
const INSTANTANEAS = new Map<string, FilaSeguimiento>();
const MAXIMO_INSTANTANEAS = 50;

function recordar(id: string, fila: FilaSeguimiento) {
  // Un Map recuerda el orden de inserción, así que la primera clave es la más
  // vieja. Con esto la sesión no acumula copias indefinidamente.
  if (INSTANTANEAS.size >= MAXIMO_INSTANTANEAS) {
    const masVieja = INSTANTANEAS.keys().next().value;
    if (masVieja !== undefined) INSTANTANEAS.delete(masVieja);
  }
  INSTANTANEAS.set(id, fila);
}

function borradorNuevo(): BorradorTarea {
  return { titulo: "", clienteId: "", fecha: sumarDias(hoy(), 4) };
}

export default function HoyPage() {
  const pendientes = useQuery(api.seguimientos.listPendientes);
  const { mostrar, mostrarError } = useToast();

  const [overlay, setOverlay] = useState<QueOverlay>(null);
  const [borrador, setBorrador] = useState<BorradorTarea>(borradorNuevo);
  /** El alta de cliente se abrió desde la tarea, así que al salir se vuelve. */
  const [volverATarea, setVolverATarea] = useState(false);
  /** Cambia en cada apertura del alta de cliente, para devolverla a limpio. */
  const [aperturaCliente, setAperturaCliente] = useState(0);

  const marcarHecho = useMutation(api.seguimientos.marcarHecho).withOptimisticUpdate(
    (localStore, { seguimientoId }) => {
      const actual = localStore.getQuery(api.seguimientos.listPendientes, {});
      if (actual === undefined) return;

      const fila = actual.find((s) => s._id === seguimientoId);
      if (fila) recordar(seguimientoId, fila);

      localStore.setQuery(
        api.seguimientos.listPendientes,
        {},
        actual.filter((s) => s._id !== seguimientoId),
      );
    },
  );

  const deshacer = useMutation(api.seguimientos.deshacer).withOptimisticUpdate(
    (localStore, { seguimientoId }) => {
      const actual = localStore.getQuery(api.seguimientos.listPendientes, {});
      const fila = INSTANTANEAS.get(seguimientoId);
      if (actual === undefined || fila === undefined) return;
      if (actual.some((s) => s._id === seguimientoId)) return;

      localStore.setQuery(api.seguimientos.listPendientes, {}, [...actual, fila]);
    },
  );

  function completar(fila: FilaSeguimiento) {
    // Sin `await` antes del aviso: el cambio y su confirmación son instantáneos,
    // y el error, si lo hay, llega después.
    const guardado = marcarHecho({ seguimientoId: fila._id });

    mostrar(AVISOS.seguimientoCompletado, {
      label: "Deshacer",
      onClick: () => {
        deshacer({ seguimientoId: fila._id }).catch((e: unknown) =>
          mostrarError(e instanceof Error ? e.message : "No se ha podido deshacer"),
        );
      },
    });

    guardado.catch((e: unknown) =>
      mostrarError(e instanceof Error ? e.message : "No se ha podido guardar"),
    );
  }

  function abrirAccion(accion: AccionRapida) {
    if (accion === "tarea") setBorrador(borradorNuevo());
    if (accion === "cliente") setAperturaCliente((n) => n + 1);
    setVolverATarea(false);
    setOverlay(accion);
  }

  /**
   * Cerrar un overlay solo lo cierra si sigue siendo el que está delante.
   *
   * Sin esta comprobación, encadenar "Nueva tarea" → "Nuevo cliente" se rompe:
   * al abrir el segundo, el <dialog> del primero se cierra y dispara su
   * `onClose`, que borraría de vuelta el overlay que acaba de abrirse.
   */
  const cerrarSi = (cual: QueOverlay) => () =>
    setOverlay((actual) => (actual === cual ? null : actual));

  function cerrarCliente() {
    setOverlay((actual) =>
      actual !== "cliente" ? actual : volverATarea ? "tarea" : null,
    );
    setVolverATarea(false);
  }

  function clienteCreado(clienteId: Id<"clientes">) {
    mostrar(AVISOS.clienteAnadido);
    if (volverATarea) {
      // Se vuelve a la tarea con lo escrito intacto y este cliente ya elegido.
      // No se abre su ficha: quien está creando el cliente venía a otra cosa.
      setBorrador((b) => ({ ...b, clienteId }));
      setOverlay("tarea");
    } else {
      setOverlay(null);
    }
    setVolverATarea(false);
  }

  const grupos = agruparParaHoy(pendientes ?? []);
  const cargando = pendientes === undefined;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-caps text-text-subtle uppercase">
          {fechaLarga()}
        </span>
        {/* No es un encabezado: el <h1> de la pantalla es el "Hoy" de la barra
            superior, y de este recuento no cuelga nada — los <h2> son los
            títulos de sección. Con `aria-live` se reanuncia al completar una
            tarea, que es justo cuando cambia. El espacio duro reserva el alto
            de la línea mientras carga, para que no salte la maquetación. */}
        <p aria-live="polite" className="text-2xl font-semibold text-text">
          {cargando ? "\u00a0" : titular(grupos.totalHoy)}
        </p>
      </header>

      <AccionesRapidas onAccion={abrirAccion} />

      {cargando ? (
        <Card padding={false}>
          <div className="px-4.5 py-2">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </Card>
      ) : (
        <>
          {grupos.totalHoy === 0 && (
            <Card padding={false}>
              <EmptyState
                icon={<CheckCheck size={28} strokeWidth={1.5} aria-hidden />}
                title="No hay seguimientos para hoy"
                help="Estás al día. Disfruta del día o añade un nuevo seguimiento."
                action={
                  <Button variant="primary" onClick={() => abrirAccion("tarea")}>
                    Nueva tarea
                  </Button>
                }
              />
            </Card>
          )}

          <SeccionSeguimientos
            seccion="atrasado"
            items={grupos.atrasados}
            onCompletar={completar}
          />
          <SeccionSeguimientos
            seccion="hoy"
            items={grupos.paraHoy}
            onCompletar={completar}
          />
          {/* Las próximas se dibujan aunque el titular esté a cero: un
              seguimiento programado para mañana no puede ser invisible hasta
              que vence, que es justo lo que este CRM viene a evitar. */}
          <SeccionSeguimientos
            seccion="proxima"
            items={grupos.proximas}
            onCompletar={completar}
          />
        </>
      )}

      <OverlayNuevaTarea
        abierto={overlay === "tarea"}
        onCerrar={cerrarSi("tarea")}
        borrador={borrador}
        onCambiar={setBorrador}
        onNuevoCliente={() => {
          setAperturaCliente((n) => n + 1);
          setVolverATarea(true);
          setOverlay("cliente");
        }}
        onCreada={() => {
          setBorrador(borradorNuevo());
          setOverlay(null);
        }}
      />

      <OverlayNuevoCliente
        key={aperturaCliente}
        abierto={overlay === "cliente"}
        onCerrar={cerrarCliente}
        onCreado={clienteCreado}
      />

      <OverlayPorConstruir
        abierto={overlay === "interaccion"}
        onCerrar={cerrarSi("interaccion")}
        titulo="Registrar interacción"
        issue="JES-62"
        lineas="líneas 540–566"
        descripcion="Canal, qué se habló y la fecha. Abierto desde aquí trae selector de cliente, y al guardar adelanta la fecha de último contacto."
      />

      <OverlayPorConstruir
        abierto={overlay === "venta"}
        onCerrar={cerrarSi("venta")}
        titulo="Registrar venta"
        issue="JES-65"
        lineas="líneas 567–600"
        descripcion="Concepto, importe en euros, estado y fecha. Abierto desde aquí trae selector de cliente. Una venta no cuenta como contacto."
      />
    </div>
  );
}

/** El titular cuenta SOLO atrasados y de hoy. Las próximas no suman. */
function titular(total: number) {
  if (total === 0) return "Todo al día";
  if (total === 1) return "1 seguimiento";
  return `${total} seguimientos`;
}
