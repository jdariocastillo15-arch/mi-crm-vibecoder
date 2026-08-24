"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Building2, Mail, Phone } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input, Textarea } from "@/components/ui/Field";
import { Chips } from "@/components/ui/Chips";
import { useToast } from "@/components/ui/Toast";
import { CANAL_ORIGEN, type CanalOrigen } from "@/lib/constants";
import { esEmailValido } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Alta rápida de cliente — implementa JES-52.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 476–497.
 *
 * Apuntar un cliente en pocos segundos, muchas veces con él delante o al
 * teléfono. De ahí que solo el nombre y un medio de contacto sean obligatorios.
 *
 * `onCreado` recibe el id y es la PANTALLA quien decide qué hacer con él: abrir
 * su ficha, o volver a "Nueva tarea" con el cliente ya seleccionado si el alta
 * venía encadenada desde ahí. El formulario no sabe de dónde lo han abierto.
 *
 * No guarda borrador y cada apertura empieza limpia — la pantalla lo remonta
 * cambiando su `key`.
 */
const VACIO = {
  nombre: "",
  empresa: "",
  telefono: "",
  email: "",
  nota: "",
};

const OPCIONES_CANAL = (
  Object.entries(CANAL_ORIGEN) as [CanalOrigen, string][]
).map(([valor, etiqueta]) => ({ valor, etiqueta }));

export function OverlayNuevoCliente({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (clienteId: Id<"clientes">) => void;
}) {
  const crear = useMutation(api.clientes.crear);
  const { mostrarError } = useToast();

  const [form, setForm] = useState(VACIO);
  const [canal, setCanal] = useState<CanalOrigen | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const campo = (k: keyof typeof VACIO) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const nombre = form.nombre.trim();
  const telefono = form.telefono.trim();
  const email = form.email.trim();

  const errorNombre = !nombre ? "Añade un nombre" : null;
  const faltaContacto = !telefono && !email;
  const errorEmail = email && !esEmailValido(email) ? "Email no válido" : null;

  async function guardar() {
    setIntentado(true);
    if (errorNombre || faltaContacto || errorEmail) return;

    setGuardando(true);
    try {
      const id = await crear({
        nombre,
        empresa: form.empresa.trim() || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        canal: canal ?? undefined,
        nota: form.nota.trim() || undefined,
      });
      onCreado(id);
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
      titulo="Nuevo cliente"
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
        label="Teléfono"
        type="tel"
        inputMode="tel"
        value={form.telefono}
        onChange={campo("telefono")}
        placeholder="+34 600 000 000"
        icon={<Phone size={16} strokeWidth={1.5} />}
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

      {/* La regla de contacto es de los DOS campos, no de uno, así que va como
          una línea suelta bajo ambos y no como error de ninguno. Está siempre
          visible —para que se sepa antes de fallar— y solo cambia de color.
          Sin margen propio: sigue el mismo ritmo que el resto de filas del
          overlay, como en el diseño. */}
      <p
        className={cn(
          "text-[13px]",
          intentado && faltaContacto ? "text-error-text" : "text-text-muted",
        )}
      >
        Indica al menos un teléfono o un email
      </p>

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
