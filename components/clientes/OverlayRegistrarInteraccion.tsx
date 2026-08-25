"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Calendar, User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Chips } from "@/components/ui/Chips";
import { useToast } from "@/components/ui/Toast";
import { AVISOS, CANAL_INTERACCION, type CanalInteraccion } from "@/lib/constants";
import { esFechaValida, hoy } from "@/lib/format";

/**
 * "Registrar interacción" — implementa JES-62.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 540–581.
 *
 * La necesidad original de Carlos: anotar qué se habló para no depender de la
 * memoria ni de notas sueltas. Es también lo que mantiene al día la fecha de
 * último contacto (JES-63), que nadie escribe a mano.
 *
 * Se abre desde dos sitios y la diferencia es una sola: **si ya sabemos de qué
 * cliente es, no se pregunta**. Desde la ficha llega el `clienteId`; desde las
 * acciones rápidas de "Hoy" no, y entonces aparece el desplegable.
 */

const OPCIONES_CANAL = (
  Object.entries(CANAL_INTERACCION) as [CanalInteraccion, string][]
).map(([valor, etiqueta]) => ({ valor, etiqueta }));

export function OverlayRegistrarInteraccion({
  abierto,
  onCerrar,
  clienteId,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Si viene, el cliente ya se conoce y no se pregunta por él. */
  clienteId?: Id<"clientes">;
}) {
  const sabemosElCliente = clienteId !== undefined;
  // La lista solo hace falta para el desplegable. Desde la ficha no se pide.
  const clientes = useQuery(api.clientes.list, sabemosElCliente ? "skip" : {});
  const me = useQuery(api.users.me);
  const crear = useMutation(api.interacciones.crear);
  const { mostrar, mostrarError } = useToast();

  const [elegido, setElegido] = useState("");
  const [canal, setCanal] = useState<CanalInteraccion>("llamada");
  const [fecha, setFecha] = useState(hoy);
  const [texto, setTexto] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nota = texto.trim();
  const errorTexto = !nota ? "Escribe qué pasó" : null;
  // Solo puede faltar cuando se pregunta por él.
  const errorCliente = !sabemosElCliente && !elegido ? "Selecciona un cliente" : null;

  async function guardar() {
    setIntentado(true);
    if (errorTexto || errorCliente) return;

    setGuardando(true);
    try {
      await crear({
        // El id de la ficha ya viene tipado; el del desplegable es un texto, y
        // solo se convierte DESPUÉS de comprobar que hay algo elegido.
        clienteId: clienteId ?? (elegido as Id<"clientes">),
        canal,
        texto: nota,
        // Nunca se manda cadena vacía. `interacciones.crear` hace
        // `args.fecha ?? hoy()`, y un `""` no cae en ese `??`: se guardaría una
        // interacción sin fecha, que además rompería la comparación con la que
        // se adelanta el último contacto. O una fecha válida, o nada.
        fecha: esFechaValida(fecha) ? fecha : undefined,
      });
      mostrar(AVISOS.interaccionRegistrada);
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
      titulo="Registrar interacción"
      onGuardar={guardar}
      guardando={guardando}
    >
      {/* Sin "+ Nuevo cliente", a diferencia de "Nueva tarea": aquí se anota lo
          que acaba de pasar con alguien que ya existe. */}
      {!sabemosElCliente && (
        <Select
          label="Cliente"
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          error={intentado ? errorCliente : null}
        >
          <option value="">Selecciona un cliente</option>
          {clientes?.map((c) => (
            <option key={c._id} value={c._id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      )}

      {/* "En persona", no "Redes": el canal de ORIGEN del cliente sí mantiene
          "Redes". Son dos cosas distintas — por dónde llegó frente a por dónde
          se le habló esta vez. */}
      <Chips
        label="Canal"
        opciones={OPCIONES_CANAL}
        valor={canal}
        onChange={(v) => v && setCanal(v)}
      />

      <Input
        label="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        icon={<Calendar size={16} strokeWidth={1.5} />}
      />

      {/* `data-foco` porque el criterio pide que el foco entre aquí, y sin eso
          `Overlay` enfocaría el primer campo, que es el cliente o la fecha. */}
      <Textarea
        label="Nota"
        data-foco
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoCapitalize="sentences"
        placeholder="Qué se ha hablado, próximos pasos…"
        error={intentado ? errorTexto : null}
      />

      {/* La autoría no se elige: la firma quien está dentro. Mientras no se
          sepa el nombre no se pinta la línea — antes que enseñar un hueco o,
          peor, la palabra "undefined". */}
      {me?.name && (
        <p className="flex items-center gap-2 text-[13px] text-text-muted">
          <User size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-text-subtle" />
          Se registrará como {me.name}
        </p>
      )}
    </Overlay>
  );
}
