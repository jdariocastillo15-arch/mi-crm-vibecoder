"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
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
 * Qué se le dice a la persona según el motivo que manda el servidor.
 *
 * LOS TEXTOS VIVEN AQUÍ, y no en el servidor, porque **el mensaje de un error
 * de servidor no llega al navegador en producción**: Convex no revela nada de
 * los errores no controlados y sustituye el texto por un escueto `Server Error`.
 * La primera versión de este overlay comparaba cadenas contra lo que mandaba
 * `cuenta.ts`, así que en producción no habría reconocido ninguna y todos los
 * fallos habituales habrían caído en el mismo aviso genérico. Lo encontró
 * auditoría.
 *
 * Lo que sí sobrevive es el `data` de un `ConvexError`, y por ahí viaja el
 * motivo. Es el mismo criterio que ya usaba el login (`login/page.tsx:201`),
 * que tampoco lee el mensaje del servidor; la diferencia es que aquí hay que
 * distinguir dos casos y allí no.
 *
 * La lista equivalente está en `convex/cuenta.ts`. No se comparte un módulo a
 * propósito: importar desde `convex/` traería al navegador todo el servidor.
 * Un motivo que no esté aquí cae en el genérico, así que separarlas no rompe
 * nada.
 */
const TEXTO_POR_MOTIVO: Record<string, string> = {
  actual_vacia: "Introduce tu contraseña actual",
  actual_incorrecta: "La contraseña actual no es correcta",
  demasiados_intentos:
    "Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo",
  muy_corta: `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres`,
  sin_contrasena: "Todavía no has establecido una contraseña",
  sin_correo: "Esta cuenta no tiene ningún correo asociado",
  sin_sesion: "Tu sesión ha terminado. Vuelve a entrar para cambiarla",
  cuenta_ajena: "Tu sesión ha terminado. Vuelve a entrar para cambiarla",
};

/**
 * Los que se enseñan JUNTO al campo de la contraseña actual, porque es ahí
 * donde está el problema y donde hay que corregirlo. El resto va en un aviso.
 */
const MOTIVOS_DEL_CAMPO = new Set([
  "actual_vacia",
  "actual_incorrecta",
  "demasiados_intentos",
]);

/**
 * Para todo lo demás. Cubre lo que pidió auditoría: un motivo que no
 * reconozcamos, y cualquier excepción que no sea nuestra —de la librería, de la
 * red o de la consulta interna— acaban aquí y no en un mensaje inventado.
 */
const GENERICO = "No se ha podido cambiar la contraseña";

/** El motivo que viaja en el `data`, si es que lo hay. */
function motivoDe(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const datos = error.data as { motivo?: unknown } | null | undefined;
  if (datos === null || typeof datos !== "object") return null;
  return typeof datos.motivo === "string" ? datos.motivo : null;
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

  // Vacía es vacía, sin recortar espacios. Una contraseña puede ser espacios, y
  // el servidor la acepta si cumple la longitud: normalizarla aquí para
  // validarla sería frenar en el formulario algo que el servidor sí admite.
  const errorActual =
    actual.length === 0 ? "Introduce tu contraseña actual" : null;
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
      const motivo = motivoDe(e);
      const texto = motivo === null ? GENERICO : (TEXTO_POR_MOTIVO[motivo] ?? GENERICO);

      if (motivo !== null && MOTIVOS_DEL_CAMPO.has(motivo)) {
        setErrorServidor(texto);
      } else {
        mostrarError(texto);
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
