"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { AVISOS, MINIMO_CONTRASENA } from "@/lib/constants";

/**
 * "Cambiar contraseña" — implementa parte de JES-49.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 662–669.
 *
 * El servidor (`convex/cuenta.ts`) vuelve a comprobar TODO lo que se valida
 * aquí. Esto solo existe para dar el mensaje antes de la ida y vuelta.
 *
 * SON OCHO CARACTERES, no los seis del prototipo. Lo exige la librería en
 * `validateDefaultPasswordRequirements`, y el login ya usaba ese número: con
 * seis, esta pantalla dejaría guardada una contraseña que el alta habría
 * rechazado.
 */

/**
 * Lo que dice el servidor sobre la contraseña ACTUAL, que va en su campo y no
 * en un aviso suelto. Mismo criterio que `OverlayUsuario` con el correo
 * duplicado: el error se enseña donde está el problema.
 */
const ERRORES_DE_LA_ACTUAL = [
  "la contraseña actual no es correcta",
  "introduce tu contraseña actual",
  "demasiados intentos fallidos",
];

function esErrorDeLaActual(mensaje: string): boolean {
  const m = mensaje.toLowerCase();
  return ERRORES_DE_LA_ACTUAL.some((e) => m.includes(e));
}

export function OverlayCambiarContrasena({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const cambiar = useAction(api.cuenta.cambiarContrasena);
  const { mostrar, mostrarError } = useToast();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const errorActual = !actual.trim() ? "Introduce tu contraseña actual" : null;
  const errorNueva =
    nueva.length < MINIMO_CONTRASENA
      ? `Mínimo ${MINIMO_CONTRASENA} caracteres`
      : null;
  const errorRepetir =
    repetir !== nueva ? "Las contraseñas no coinciden" : null;

  function limpiar() {
    setActual("");
    setNueva("");
    setRepetir("");
    setIntentado(false);
    setErrorServidor(null);
  }

  async function guardar() {
    setIntentado(true);
    setErrorServidor(null);
    if (errorActual || errorNueva || errorRepetir) return;

    setGuardando(true);
    try {
      const { sesionesCerradas } = await cambiar({ actual, nueva });

      // La contraseña está cambiada en los dos casos. Si no se han podido
      // cerrar las otras sesiones, se dice, en vez de callarlo o de fingir que
      // ha fallado todo.
      mostrar(
        sesionesCerradas
          ? AVISOS.contrasenaActualizada
          : `${AVISOS.contrasenaActualizada}, pero no se han podido cerrar las otras sesiones`,
      );
      limpiar();
      onCerrar();
    } catch (e) {
      const mensaje =
        e instanceof Error ? e.message : "No se ha podido cambiar la contraseña";
      if (esErrorDeLaActual(mensaje)) {
        setErrorServidor(mensaje);
      } else {
        mostrarError(mensaje);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Overlay
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Cambiar contraseña"
      onGuardar={guardar}
      guardando={guardando}
    >
      <Input
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        value={actual}
        onChange={(e) => {
          setActual(e.target.value);
          // Lo que dijo el servidor era sobre lo que se tecleó antes.
          setErrorServidor(null);
        }}
        error={errorServidor ?? (intentado ? errorActual : null)}
      />

      <Input
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        helper={`Mínimo ${MINIMO_CONTRASENA} caracteres`}
        error={intentado ? errorNueva : null}
      />

      <Input
        label="Repetir nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={repetir}
        onChange={(e) => setRepetir(e.target.value)}
        error={intentado ? errorRepetir : null}
      />

      <p className="text-[13px] text-text-muted">
        Al cambiarla se cerrarán tus sesiones en otros dispositivos. Esta sigue
        abierta.
      </p>
    </Overlay>
  );
}
