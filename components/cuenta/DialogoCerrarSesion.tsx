"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Overlay } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";

/**
 * Confirmar el cierre de sesión — implementa parte de JES-49.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 670–679.
 *
 * **No lleva el pie estándar** de Cancelar/Guardar: lleva el suyo, con el botón
 * diciendo lo que hace. Mismo criterio que `DialogoEliminar`.
 *
 * Y navega al login DESPUÉS de esperar a `signOut()`. Sin eso, la sesión se
 * limpia pero la URL se queda donde estaba —el middleware solo actúa en la
 * siguiente navegación— y la pantalla se queda pidiendo datos que ya no puede
 * traer. Es JES-89; aquí se cierra para las dos salidas que tiene la
 * aplicación, esta y la de la barra lateral.
 *
 * `replace` y no `push`: el botón de atrás no debe devolver a una pantalla que
 * ya no se puede cargar.
 */
export function DialogoCerrarSesion({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function confirmar() {
    setSaliendo(true);
    // La librería ya captura por dentro el fallo de `auth:signOut` y borra los
    // tokens igualmente (`react/client.js:164-174`), así que aquí no hay nada
    // que atrapar: si algo va mal, la sesión local se ha ido de todas formas y
    // lo que toca es llevar a la persona al login.
    await signOut();
    router.replace("/login");
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
