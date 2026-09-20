"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AVISOS } from "@/lib/constants";
import type { Persona } from "./ListaEquipo";

/**
 * Qué se le dice a quien topa con una de las dos protecciones — JES-97.
 *
 * LOS TEXTOS VIVEN AQUÍ, no en el servidor, porque **el mensaje de un `Error`
 * no llega al navegador en producción**: Convex lo sustituye por «Server
 * Error». Lo que sí viaja es el `data` de un `ConvexError`, y por ahí llega el
 * motivo. La lista equivalente está en `convex/users.ts`; no se comparte un
 * módulo a propósito, que importar desde `convex/` traería el servidor entero.
 *
 * Mismo patrón que `components/cuenta/OverlayCambiarContrasena.tsx`, donde está
 * la explicación larga.
 */
const TEXTO_POR_MOTIVO: Record<string, string> = {
  cuenta_propia: "No puedes eliminar tu propia cuenta",
  ultima_duena: "El equipo no puede quedarse sin nadie que lo lleve",
};

/**
 * Para todo lo demás: un motivo que no reconozcamos, o cualquier excepción que
 * no sea nuestra —de la red, de la librería—, acaban aquí y no en un texto
 * inventado.
 */
const GENERICO = "No se ha podido eliminar";

/** El motivo que viaja en el `data`, si es que lo hay. */
function motivoDe(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const datos = error.data as { motivo?: unknown } | null | undefined;
  if (datos === null || typeof datos !== "object") return null;
  return typeof datos.motivo === "string" ? datos.motivo : null;
}

/**
 * Confirmar que se saca a alguien del equipo — implementa parte de JES-70.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 645–654.
 *
 * Es la única acción destructiva del CRM, así que **no lleva el pie estándar**
 * de Cancelar/Guardar: lleva el suyo, con el botón en rojo y diciendo lo que
 * hace. Un «Guardar» verde para esto sería mentir sobre lo que va a pasar.
 *
 * Lo que el texto NO dice, y es deliberado: que su historial se conserva. Quien
 * está a punto de sacar a alguien del equipo necesita saber que la acción no se
 * puede deshacer, no un párrafo sobre el modelo de datos. Que las interacciones
 * y las ventas sigan ahí es lo que se espera; contarlo aquí solo añadiría ruido
 * en el peor momento para leerlo.
 */
export function DialogoEliminar({
  persona,
  onCerrar,
}: {
  /** `null` = cerrado. Con persona, el diálogo está abierto sobre ella. */
  persona: Persona | null;
  onCerrar: () => void;
}) {
  const eliminar = useMutation(api.users.eliminarUsuario);
  const { mostrar, mostrarError } = useToast();
  const [eliminando, setEliminando] = useState(false);

  async function confirmar() {
    if (persona === null) return;
    setEliminando(true);
    try {
      const { reasignados } = await eliminar({ usuarioId: persona._id });
      mostrar(
        reasignados > 0
          ? `${AVISOS.usuarioEliminado} · ${textoReasignados(reasignados)}`
          : AVISOS.usuarioEliminado,
      );
      onCerrar();
    } catch (e) {
      const motivo = motivoDe(e);
      mostrarError(
        motivo === null ? GENERICO : (TEXTO_POR_MOTIVO[motivo] ?? GENERICO),
      );
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Overlay
      abierto={persona !== null}
      onCerrar={onCerrar}
      titulo="Eliminar usuario"
      pie={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={onCerrar}
            disabled={eliminando}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            fullWidth
            onClick={confirmar}
            loading={eliminando}
          >
            Eliminar
          </Button>
        </div>
      }
    >
      <p className="text-[15px] text-text">
        ¿Seguro que quieres eliminar a{" "}
        <strong className="font-semibold">{persona?.name}</strong>? Esta acción
        no se puede deshacer.
      </p>
    </Overlay>
  );
}

/** «1 seguimiento reasignado» / «N seguimientos reasignados». */
function textoReasignados(n: number): string {
  return n === 1
    ? "1 seguimiento reasignado"
    : `${n} seguimientos reasignados`;
}
