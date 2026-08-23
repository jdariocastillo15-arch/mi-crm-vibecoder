"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { AVISOS } from "@/lib/constants";
import { esFechaValida } from "@/lib/format";

/**
 * "Nueva tarea" — implementa JES-59.
 *
 * Apuntarse trabajo desde "Hoy" sin haber entrado en ninguna ficha. No deja
 * elegir responsable, a diferencia de "Programar seguimiento": desde aquí uno
 * se apunta trabajo para sí mismo, y de eso ya se encarga el servidor.
 *
 * El borrador NO vive aquí, vive en la pantalla. Es lo que permite salir al
 * alta de cliente y volver con lo escrito intacto: si el estado estuviera
 * dentro de este componente, cerrarlo lo perdería.
 */
export type BorradorTarea = {
  titulo: string;
  clienteId: string;
  fecha: string;
};

export function OverlayNuevaTarea({
  abierto,
  onCerrar,
  borrador,
  onCambiar,
  onNuevoCliente,
  onCreada,
}: {
  abierto: boolean;
  onCerrar: () => void;
  borrador: BorradorTarea;
  onCambiar: (borrador: BorradorTarea) => void;
  onNuevoCliente: () => void;
  onCreada: () => void;
}) {
  const clientes = useQuery(api.clientes.list);
  const crear = useMutation(api.seguimientos.crear);
  const { mostrar, mostrarError } = useToast();

  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const titulo = borrador.titulo.trim();
  const errorTitulo = !titulo ? "Indica qué hay que hacer" : null;
  const errorCliente = !borrador.clienteId ? "Selecciona un cliente" : null;
  // El campo de fecha se puede vaciar, y el navegador deja escribir fechas que
  // no existen. Sin esto el fallo llegaba como aviso suelto del servidor, en
  // vez de señalar el campo como hacen los otros dos.
  const errorFecha = !esFechaValida(borrador.fecha) ? "Indica una fecha" : null;

  async function guardar() {
    setIntentado(true);
    if (errorTitulo || errorCliente || errorFecha) return;

    setGuardando(true);
    try {
      await crear({
        clienteId: borrador.clienteId as Id<"clientes">,
        accion: titulo,
        vence: borrador.fecha,
      });
      mostrar(AVISOS.tareaCreada);
      setIntentado(false);
      onCreada();
    } catch (e) {
      mostrarError(e instanceof Error ? e.message : "No se ha podido guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Overlay
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nueva tarea"
      onGuardar={guardar}
      guardando={guardando}
    >
      <Input
        label="Título"
        value={borrador.titulo}
        onChange={(e) => onCambiar({ ...borrador, titulo: e.target.value })}
        autoCapitalize="sentences"
        placeholder="Llamar para cierre"
        error={intentado ? errorTitulo : null}
      />

      <Select
        label="Cliente"
        value={borrador.clienteId}
        onChange={(e) => onCambiar({ ...borrador, clienteId: e.target.value })}
        error={intentado ? errorCliente : null}
        accion={
          <button
            type="button"
            onClick={onNuevoCliente}
            className="rounded-md px-1 text-sm font-medium text-primary"
          >
            + Nuevo cliente
          </button>
        }
      >
        <option value="">Selecciona un cliente</option>
        {clientes?.map((c) => (
          <option key={c._id} value={c._id}>
            {c.nombre}
          </option>
        ))}
      </Select>

      {/* "Fecha", no "Fecha y hora": aquí solo se guarda el día, como en el
          resto de la aplicación. */}
      <Input
        label="Fecha"
        type="date"
        value={borrador.fecha}
        onChange={(e) => onCambiar({ ...borrador, fecha: e.target.value })}
        error={intentado ? errorFecha : null}
      />
    </Overlay>
  );
}
