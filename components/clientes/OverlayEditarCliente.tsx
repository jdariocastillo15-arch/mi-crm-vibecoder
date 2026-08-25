"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Building2, Mail, Phone } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input, Textarea } from "@/components/ui/Field";
import { Chips } from "@/components/ui/Chips";
import { useToast } from "@/components/ui/Toast";
import {
  CANAL_ORIGEN,
  ESTADO_CLIENTE,
  type CanalOrigen,
  type EstadoCliente,
  type Tono,
} from "@/lib/constants";
import { esEmailValido } from "@/lib/format";

/**
 * Editar cliente — implementa JES-54.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 498–514.
 *
 * ESTE ES EL ÚNICO SITIO DE TODA LA APLICACIÓN DONDE SE CAMBIA EL ESTADO DE UN
 * CLIENTE. Es lo que sustituye al tablero kanban que el PRD original planteaba:
 * en vez de arrastrar tarjetas entre columnas, se abre la ficha y se marca en
 * qué punto está la relación.
 *
 * Recibe el cliente entero por prop en vez de consultarlo: la ficha ya lo tiene
 * delante, y pedirlo otra vez sería una consulta de más para el mismo dato.
 *
 * Cada apertura vuelve a cargar los datos actuales porque la ficha lo remonta
 * cambiando su `key`. Sin eso, lo escrito y descartado en una apertura anterior
 * seguiría ahí, que es justo lo contrario de "precarga los datos actuales".
 */

const OPCIONES_CANAL = (
  Object.entries(CANAL_ORIGEN) as [CanalOrigen, string][]
).map(([valor, etiqueta]) => ({ valor, etiqueta }));

/** Los cinco, en el orden del diseño, cada uno con su color. */
const OPCIONES_ESTADO = (
  Object.entries(ESTADO_CLIENTE) as [EstadoCliente, { label: string; tono: Tono }][]
).map(([valor, { label, tono }]) => ({ valor, etiqueta: label, tono }));

export function OverlayEditarCliente({
  cliente,
  abierto,
  onCerrar,
}: {
  cliente: Doc<"clientes">;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const actualizar = useMutation(api.clientes.actualizar);
  const { mostrarError } = useToast();

  const [form, setForm] = useState({
    nombre: cliente.nombre,
    empresa: cliente.empresa ?? "",
    email: cliente.email ?? "",
    telefono: cliente.telefono ?? "",
    nota: cliente.nota ?? "",
  });
  const [estado, setEstado] = useState<EstadoCliente>(cliente.estado);
  const [canal, setCanal] = useState<CanalOrigen | null>(cliente.canal ?? null);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const campo = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const nombre = form.nombre.trim();
  const email = form.email.trim();

  const errorNombre = !nombre ? "Añade un nombre" : null;

  // Aquí NO se exige un medio de contacto, a diferencia del alta. Ni el diseño
  // ni `clientes.actualizar` lo piden, y con razón: quien abre esto para marcar
  // "Ganado" no tiene por qué arreglar antes un teléfono que ya faltaba.
  //
  // El email se valida con la MISMA regla que el servidor —solo si cambia—,
  // para que los dos acepten y rechacen exactamente lo mismo. Un email antiguo
  // mal escrito no bloquea el resto de la ficha; uno nuevo mal escrito sí.
  const emailCambia = email !== (cliente.email ?? "");
  const errorEmail =
    emailCambia && email.length > 0 && !esEmailValido(email)
      ? "Email no válido"
      : null;

  async function guardar() {
    setIntentado(true);
    if (errorNombre || errorEmail) return;

    setGuardando(true);
    try {
      // Los vacíos van como `undefined` y Convex borra esos campos al aplicar
      // el `patch`. Es lo que permite dejar la empresa en blanco de verdad, y
      // no arrastrar la anterior como hace el prototipo.
      await actualizar({
        clienteId: cliente._id,
        nombre,
        empresa: form.empresa.trim() || undefined,
        email: email || undefined,
        telefono: form.telefono.trim() || undefined,
        canal: canal ?? undefined,
        nota: form.nota.trim() || undefined,
        estado,
      });
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
      titulo="Editar cliente"
      onGuardar={guardar}
      guardando={guardando}
    >
      <Input
        label="Nombre"
        value={form.nombre}
        onChange={campo("nombre")}
        autoCapitalize="words"
        placeholder="Marta López"
        error={intentado ? errorNombre : null}
      />

      <Input
        label="Empresa"
        value={form.empresa}
        onChange={campo("empresa")}
        autoCapitalize="words"
        placeholder="Acme S.L."
        icon={<Building2 size={16} strokeWidth={1.5} />}
      />

      <Input
        label="Email"
        type="email"
        inputMode="email"
        value={form.email}
        onChange={campo("email")}
        autoCapitalize="none"
        placeholder="nombre@empresa.es"
        icon={<Mail size={16} strokeWidth={1.5} />}
        error={intentado ? errorEmail : null}
      />

      <Input
        label="Teléfono"
        type="tel"
        inputMode="tel"
        value={form.telefono}
        onChange={campo("telefono")}
        placeholder="+34 600 000 000"
        icon={<Phone size={16} strokeWidth={1.5} />}
      />

      {/* El estado va aquí, tras los datos de contacto, donde lo pone el
          diseño, y no al final: es el control por el que más se abre este
          formulario, y detrás de la nota quedaría fuera de pantalla en el
          móvil.

          `Chips` sin `permitirVaciar` no devuelve nunca `null` —ni al volver a
          pulsar la activa ni con las flechas—, pero su firma lo admite porque
          el otro modo sí lo usa. Un cliente siempre tiene estado.

          `variante="etiqueta"` es lo que pinta cada valor como su `Badge` de
          color en vez de como un chip de texto teñido. Antes se deducía de que
          las opciones traen `tono`; desde JES-65 hay dos aspectos con tono, así
          que hay que decir cuál. Sin esto, los cinco estados se verían como los
          chips de "Registrar venta". */}
      <Chips
        label="Estado"
        opciones={OPCIONES_ESTADO}
        valor={estado}
        onChange={(v) => v && setEstado(v)}
        variante="etiqueta"
      />

      {/* Canal y Nota no están en el prototipo, que solo deja editar los datos
          de contacto. Los añade el PRD ("Cabos sueltos", punto 4) con un
          argumento difícil de discutir: si un dato se puede introducir en el
          alta, se tiene que poder corregir. */}
      <Chips
        label="Canal de origen"
        opciones={OPCIONES_CANAL}
        valor={canal}
        onChange={setCanal}
        permitirVaciar
      />

      <Textarea
        label="Nota"
        value={form.nota}
        onChange={campo("nota")}
        placeholder="Detalle del primer contacto, necesidades…"
      />
    </Overlay>
  );
}
