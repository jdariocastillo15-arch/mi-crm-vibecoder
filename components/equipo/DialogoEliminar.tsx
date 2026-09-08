"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AVISOS } from "@/lib/constants";
import type { Persona } from "./ListaEquipo";

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
      mostrarError(
        e instanceof Error ? e.message : "No se ha podido eliminar",
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
