"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";

/**
 * Salir de la aplicación y llegar al acceso. Lo comparten las TRES salidas:
 * el diálogo de «Mi cuenta», el botón de la barra lateral y la tarjeta de
 * sesión terminada.
 *
 * EL ORDEN NO ES DECORATIVO, y aquí está el motivo de que esto sea un hook y no
 * tres copias.
 *
 * Un enlace a `/login` **no basta**, y la tercera salida lo demostró: el
 * middleware pregunta por `auth:isAuthenticated`, que es literalmente
 * `getUserIdentity() !== null` (`server/implementation/index.js:310`). Eso
 * valida **el JWT** y no mira `authSessions`. Cuando otra sesión cambia la
 * contraseña, `invalidateSessions` borra la sesión pero el JWT del navegador
 * sigue siendo válido hasta una hora (`implementation/tokens.js:4`). Con ese
 * JWT vivo, el middleware da por autenticado al navegador y devuelve `/login`
 * a `/hoy`, donde `requireUser` sí comprueba la sesión y lo rechaza todo.
 *
 * Comprobado en desarrollo antes de escribir esto: la pantalla no rebotaba sin
 * más, reventaba con «No hay sesión iniciada» y sin nada que lo recogiera,
 * porque la aplicación todavía no tiene barrera de error (R1 de la auditoría).
 *
 * `signOut()` borra los tokens del navegador, así que después el middleware ya
 * no lo da por autenticado y `/login` se queda en `/login`. Por eso se **espera**
 * antes de navegar: sin el `await`, la navegación adelantaría al borrado y se
 * volvería al mismo rebote.
 *
 * `replace` y no `push`: el botón de atrás no debe devolver a una pantalla que
 * ya no se puede cargar.
 *
 * No hace falta capturar nada. La librería ya atrapa por dentro el fallo de
 * `auth:signOut` y borra los tokens igualmente (`react/client.js:164-174`), que
 * es justo lo que pasa cuando la sesión ya estaba revocada.
 */
export function useSalirAlAcceso() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  return useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [signOut, router]);
}
