"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Overlay } from "@/components/ui/Overlay";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { CANAL_ORIGEN, type CanalOrigen } from "@/lib/constants";
import { esEmailValido } from "@/lib/format";

/**
 * Alta rápida de cliente — el formulario de JES-52.
 *
 * Se construye aquí porque "Nueva tarea" (JES-59) no funciona sin él: el campo
 * Cliente es obligatorio, así que sin una forma de crear uno la pantalla no se
 * puede ni usar la primera vez.
 *
 * `onCreado` recibe el id: es lo que permite volver a la tarea con el cliente
 * recién creado ya seleccionado.
 *
 * No guarda borrador y cada apertura empieza en limpio — el único que conserva
 * lo escrito es "Nueva tarea", porque es el que se interrumpe. El reinicio lo
 * hace la pantalla cambiando la `key` de este componente, que es la forma de
 * React de decir "esto es otro formulario", en vez de un efecto que se pelee
 * con el estado en cada apertura.
 */
const VACIO = {
  nombre: "",
  empresa: "",
  telefono: "",
  email: "",
  canal: "" as CanalOrigen | "",
  nota: "",
};

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
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const campo = (k: keyof typeof VACIO) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const nombre = form.nombre.trim();
  const telefono = form.telefono.trim();
  const email = form.email.trim();

  const errorNombre = !nombre ? "Añade un nombre" : null;
  const errorContacto =
    !telefono && !email ? "Indica al menos un teléfono o un email" : null;
  const errorEmail =
    email && !esEmailValido(email) ? "Ese email no es válido" : null;

  async function guardar() {
    setIntentado(true);
    if (errorNombre || errorContacto || errorEmail) return;

    setGuardando(true);
    try {
      const id = await crear({
        nombre,
        empresa: form.empresa.trim() || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        canal: form.canal || undefined,
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
        placeholder="Marta Ruiz"
        error={intentado ? errorNombre : null}
      />
      <Input
        label="Empresa"
        value={form.empresa}
        onChange={campo("empresa")}
        autoCapitalize="words"
        placeholder="Acme"
      />
      <Input
        label="Teléfono"
        type="tel"
        value={form.telefono}
        onChange={campo("telefono")}
        placeholder="600 123 456"
        error={intentado ? errorContacto : null}
      />
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={campo("email")}
        autoCapitalize="none"
        placeholder="marta@acme.es"
        error={intentado ? errorEmail : null}
      />
      <Select label="Cómo llegó" value={form.canal} onChange={campo("canal")}>
        <option value="">Sin especificar</option>
        {Object.entries(CANAL_ORIGEN).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>
      <Textarea
        label="Nota"
        value={form.nota}
        onChange={campo("nota")}
        placeholder="Lo que convenga recordar"
      />
    </Overlay>
  );
}
