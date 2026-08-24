"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Field";
import { Chips } from "@/components/ui/Chips";
import { useToast } from "@/components/ui/Toast";
import { AVISOS } from "@/lib/constants";
import { esFechaValida, hoy, sumarDias } from "@/lib/format";

/**
 * "Programar seguimiento" — implementa JES-60.
 *
 * Solo se abre desde una ficha, así que NO lleva selector de cliente: el
 * seguimiento siempre pertenece a un cliente concreto y ya lo sabemos.
 *
 * A diferencia de "Nueva tarea", aquí sí se elige responsable: desde la ficha
 * se reparte trabajo, no solo se apunta uno el suyo.
 *
 * No guarda borrador y cada apertura empieza limpia — la pantalla la remonta
 * cambiando su `key`, que es la forma de React de decir "esto es otro
 * formulario".
 */
export function OverlayProgramarSeguimiento({
  abierto,
  onCerrar,
  clienteId,
}: {
  abierto: boolean;
  onCerrar: () => void;
  clienteId: Id<"clientes">;
}) {
  const equipo = useQuery(api.users.listEquipo);
  const yo = useQuery(api.users.me);
  const crear = useMutation(api.seguimientos.crear);
  const { mostrar, mostrarError } = useToast();

  const [accion, setAccion] = useState("");
  const [fecha, setFecha] = useState(() => sumarDias(hoy(), 4));
  const [responsable, setResponsable] = useState<Id<"users"> | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // El usuario actual viene marcado, pero si ya se ha tocado el selector manda
  // lo elegido. Derivarlo evita el efecto que sincronizaría ambos estados.
  const responsableElegido = responsable ?? yo?._id ?? null;

  const errorAccion = !accion.trim() ? "Indica qué hay que hacer" : null;
  const errorFecha = !esFechaValida(fecha) ? "Indica una fecha" : null;

  async function guardar() {
    setIntentado(true);
    if (errorAccion || errorFecha || !responsableElegido) return;

    setGuardando(true);
    try {
      await crear({
        clienteId,
        accion: accion.trim(),
        vence: fecha,
        responsableId: responsableElegido,
      });
      mostrar(AVISOS.seguimientoProgramado);
      onCerrar();
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
      titulo="Programar seguimiento"
      onGuardar={guardar}
      guardando={guardando}
    >
      <Input
        label="Qué hay que hacer"
        value={accion}
        onChange={(e) => setAccion(e.target.value)}
        autoCapitalize="sentences"
        placeholder="Llamar para cerrar la propuesta"
        error={intentado ? errorAccion : null}
      />

      <Input
        label="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        error={intentado ? errorFecha : null}
      />

      {/* Los usuarios reales del equipo, no dos nombres fijos como el
          prototipo. Y se guarda el identificador, nunca el nombre: si alguien
          se cambia el nombre, su historial lo sigue reconociendo. */}
      <Chips
        label="Responsable"
        opciones={(equipo ?? []).map((u) => ({
          valor: u._id,
          etiqueta: u.name ?? u.email ?? "Sin nombre",
        }))}
        valor={responsableElegido}
        onChange={(v) => setResponsable(v)}
      />
    </Overlay>
  );
}
