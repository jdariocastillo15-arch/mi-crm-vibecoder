"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { AVISOS } from "@/lib/constants";

/**
 * "Editar mis datos" — implementa parte de JES-49.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 655–661.
 *
 * EL CORREO NO SE EDITA, y es una desviación consciente del diseño y de los
 * criterios de JES-49, que piden Nombre y Email.
 *
 * Desde JES-83 el correo dejó de ser un dato de contacto: es lo que decide si
 * una cuenta de Google abre la puerta. Si cada persona pudiera reescribirlo,
 * podría apuntarlo a un Google que controle y saltarse la provisión de quien
 * lleva el equipo. Por eso `users.ts#actualizarPerfil` solo acepta el nombre,
 * y lo dice desde antes de que existiera esta pantalla.
 *
 * Se muestra igualmente, en gris, porque quien abre "Editar mis datos"
 * buscándolo merece saber por qué no está en vez de pensar que falta.
 */
export function OverlayEditarDatos({
  abierto,
  onCerrar,
  nombreActual,
  email,
}: {
  abierto: boolean;
  onCerrar: () => void;
  nombreActual: string;
  email: string;
}) {
  const actualizar = useMutation(api.users.actualizarPerfil);
  const { mostrar, mostrarError } = useToast();

  const [nombre, setNombre] = useState(nombreActual);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nombreLimpio = nombre.trim();
  const errorNombre = !nombreLimpio ? "Indica un nombre" : null;

  async function guardar() {
    setIntentado(true);
    if (errorNombre) return;

    setGuardando(true);
    try {
      await actualizar({ name: nombreLimpio });
      mostrar(AVISOS.datosActualizados);
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
      titulo="Editar mis datos"
      onGuardar={guardar}
      guardando={guardando}
    >
      <Input
        label="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoCapitalize="words"
        placeholder="Nombre y apellidos"
        error={intentado ? errorNombre : null}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Email</span>
        <p className="text-[15px] text-text-muted">{email}</p>
        <p className="text-[13px] text-text-muted">
          El correo lo cambia quien lleva el equipo, porque es con lo que se
          entra.
        </p>
      </div>
    </Overlay>
  );
}
