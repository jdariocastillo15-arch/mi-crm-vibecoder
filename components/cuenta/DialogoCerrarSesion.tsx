"use client";

import { useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { useSalirAlAcceso } from "@/components/shell/useSalirAlAcceso";

/**
 * Confirmar el cierre de sesión — implementa parte de JES-49.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 670–679.
 *
 * **No lleva el pie estándar** de Cancelar/Guardar: lleva el suyo, con el botón
 * diciendo lo que hace. Mismo criterio que `DialogoEliminar`.
 *
 * La salida en sí la pone `useSalirAlAcceso`, que comparten las tres: esta, la
 * de la barra lateral y la de la tarjeta de sesión terminada. Ahí está escrito
 * por qué hay que esperar a `signOut()` antes de navegar.
 */
export function DialogoCerrarSesion({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const salir = useSalirAlAcceso();
  const [saliendo, setSaliendo] = useState(false);

  async function confirmar() {
    setSaliendo(true);
    await salir();
  }

  return (
    <Overlay
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Cerrar sesión"
      pie={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={onCerrar}
            disabled={saliendo}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            fullWidth
            onClick={confirmar}
            loading={saliendo}
          >
            Cerrar sesión
          </Button>
        </div>
      }
    >
      <p className="text-[15px] text-text">
        ¿Seguro que quieres cerrar sesión? Tendrás que volver a iniciar sesión
        para acceder.
      </p>
    </Overlay>
  );
}
