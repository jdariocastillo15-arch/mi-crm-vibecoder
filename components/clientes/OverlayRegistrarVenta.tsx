"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Calendar } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input, Select } from "@/components/ui/Field";
import { Chips } from "@/components/ui/Chips";
import { useToast } from "@/components/ui/Toast";
import {
  AVISOS,
  ESTADO_VENTA,
  type EstadoVenta,
  type Tono,
} from "@/lib/constants";
import { esFechaValida, hoy } from "@/lib/format";

/**
 * "Registrar venta" — implementa JES-65.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 582–614
 * (maquetación) y 1140–1156 (validación y guardado).
 *
 * Anotar lo que se vende y lo que está en marcha. El concepto es texto libre y
 * no un producto de catálogo: el catálogo exigiría una pantalla de
 * administración que no está diseñada, y frenaría justo el gesto que esto viene
 * a hacer rápido.
 *
 * Se abre desde dos sitios y la diferencia es una sola, la misma que en
 * "Registrar interacción": si ya sabemos de qué cliente es, no se pregunta.
 *
 * Una venta NO cuenta como contacto, así que registrarla no toca la fecha de
 * último contacto del cliente. Esa regla vive en `convex/ventas.ts`, que es
 * donde tiene que estar.
 */

/** Los tres, en el orden del diseño, cada uno con su color. */
const OPCIONES_ESTADO = (
  Object.entries(ESTADO_VENTA) as [EstadoVenta, { label: string; tono: Tono }][]
).map(([valor, { label, tono }]) => ({ valor, etiqueta: label, tono }));

/**
 * Los euros que se han escrito, o `NaN` si no hay ninguno.
 *
 * Se quita todo lo que no sea dígito, como hace el diseño: quien escribe
 * "1.200 €" con una mano en el móvil está diciendo mil doscientos, y rechazarlo
 * por los puntos sería una pelea con el teclado, no una validación.
 */
function euros(texto: string): number {
  return parseInt(texto.replace(/[^0-9]/g, ""), 10);
}

/**
 * ¿Lo escrito lleva céntimos?
 *
 * El campo son EUROS ENTEROS: `ventas.importe` no tiene dónde guardar los
 * céntimos. Y como `euros()` borra todo lo que no sea dígito, sin esto
 * «1.200,50» se convertía en ciento veinte mil cincuenta euros, en silencio.
 *
 * Se mira DESPUÉS de quitar la decoración y ANTES de quitar los separadores, y
 * ese orden es el arreglo. La primera versión buscaba la fracción al final de
 * lo tecleado tal cual, así que el símbolo del euro o un espacio de más la
 * escondían y el factor cien volvía por la puerta de atrás —justo los espacios
 * y el «€» que `euros()` admite a propósito—. Lo encontró auditoría.
 *
 * Uno o dos dígitos tras el separador son céntimos; tres son el separador de
 * millares. Así «1.200» y «1200» siguen siendo mil doscientos, y «1.200,50 €»
 * y «49,9» avisan.
 */
function llevaCentimos(texto: string): boolean {
  return /[.,]\d{1,2}$/.test(texto.replace(/[^0-9.,]/g, ""));
}

export function OverlayRegistrarVenta({
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
  const crear = useMutation(api.ventas.crear);
  const { mostrar, mostrarError } = useToast();

  const [elegido, setElegido] = useState("");
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [estado, setEstado] = useState<EstadoVenta>("abierta");
  const [fecha, setFecha] = useState(hoy);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const queSeVende = concepto.trim();
  const cantidad = euros(importe);

  // Los tres se calculan siempre y se pintan a la vez tras el primer intento,
  // como en el diseño: quien deja el formulario vacío tiene que ver todo lo que
  // le falta de una sola vez, no de uno en uno.
  const errorConcepto = !queSeVende ? "Indica qué se vende" : null;
  // Los céntimos van PRIMERO: quien escribe «1.200,50» no se ha equivocado de
  // número, se ha equivocado de unidad, y decirle «importe válido» no le
  // explicaría nada. `NaN > 0` es falso, así que el campo vacío cae en el
  // segundo sin comprobarlo aparte.
  const errorImporte = llevaCentimos(importe)
    ? "Los importes van en euros enteros, sin céntimos"
    : !(cantidad > 0)
      ? "Indica un importe válido"
      : null;
  const errorCliente = !sabemosElCliente && !elegido ? "Selecciona un cliente" : null;
  // El `max` del campo NO basta: `Overlay` no monta un `<form>` y su botón
  // llama a `guardar` directo, así que la validez nativa no frena nada. Una
  // fecha futura escrita a mano llegaría a la mutación, que la rechaza, pero
  // con un mensaje genérico. Aquí se dice qué pasa y dónde.
  const errorFecha = fecha > hoy() ? "No puede ser una fecha futura" : null;

  async function guardar() {
    setIntentado(true);
    if (errorConcepto || errorImporte || errorCliente || errorFecha) return;

    setGuardando(true);
    try {
      await crear({
        // El id de la ficha ya viene tipado; el del desplegable es un texto, y
        // solo se convierte DESPUÉS de comprobar que hay algo elegido.
        clienteId: clienteId ?? (elegido as Id<"clientes">),
        concepto: queSeVende,
        importe: cantidad,
        estado,
        // Nunca se manda cadena vacía. `ventas.crear` hace `args.fecha ?? hoy()`
        // y un `""` NO cae en ese `??`: se guardaría una venta sin fecha, que
        // luego rompería el orden del historial. O una fecha válida, o nada.
        //
        // El servidor vuelve a comprobarla, formato y futuro. Esto ya no es la
        // garantía, solo el atajo para no ir y volver.
        fecha: esFechaValida(fecha) ? fecha : undefined,
      });
      mostrar(AVISOS.ventaRegistrada);
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
      titulo="Registrar venta"
      onGuardar={guardar}
      guardando={guardando}
    >
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

      <Input
        label="Qué se vende"
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        autoCapitalize="sentences"
        placeholder="Licencia anual, servicio…"
        error={intentado ? errorConcepto : null}
      />

      {/* `type="tel"` e `inputMode="numeric"` para que en el móvil salga el
          teclado de números. No `type="number"`: sus flechas y su rueda no
          pintan nada aquí, y además rechaza lo que se escribe con puntos. */}
      <Input
        label="Importe (€)"
        type="tel"
        inputMode="numeric"
        value={importe}
        onChange={(e) => setImporte(e.target.value)}
        placeholder="1200"
        error={intentado ? errorImporte : null}
      />

      {/* Chips de texto teñidos de su color, no etiquetas: así lo pinta el
          diseño para las ventas. El estado de un CLIENTE sí va como etiqueta
          —ahí cada valor es una insignia que se lleva puesta—; aquí es la
          elección de un formulario. */}
      <Chips
        label="Estado"
        opciones={OPCIONES_ESTADO}
        valor={estado}
        onChange={(v) => v && setEstado(v)}
      />

      <Input
        label="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        max={hoy()}
        error={intentado ? errorFecha : null}
        icon={<Calendar size={16} strokeWidth={1.5} />}
      />
    </Overlay>
  );
}
