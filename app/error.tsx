"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ConvexError } from "convex/values";
import { LogOut, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSalirAlAcceso } from "@/components/shell/useSalirAlAcceso";

/**
 * La barrera de error de toda la aplicación — implementa parte de JES-101.
 *
 * Hasta ahora no había ninguna: cualquier error al pintar enseñaba la pantalla
 * por defecto de Next, «This page couldn't load», y solo se salía recargando.
 *
 * VA EN LA RAÍZ, y no en `app/(app)/`, porque `error.js` no envuelve el layout
 * de su propio segmento, y `AppShell` también consulta: `users.me` lanza cuando
 * la sesión ha muerto (`convex/users.ts`). Desde aquí se recogen las dos cosas.
 *
 * DOS CASOS:
 *
 * · SESIÓN TERMINADA (`sin_sesion`). Pasa cuando se revoca la sesión con la
 *   aplicación abierta: otro dispositivo cambia la contraseña, o dan de baja a
 *   esa persona. El JWT sigue valiendo hasta una hora, así que ni el middleware
 *   ni `useConvexAuth()` se enteran; solo el servidor. Se sale sola al acceso
 *   con `useSalirAlAcceso`, que ESPERA a `signOut()` antes de navegar: así el
 *   navegador llega a /login sin credenciales, y el middleware no lo devuelve.
 *
 * · CUALQUIER OTRO ERROR. Se ofrece reintentar y volver a Hoy.
 */
export default function ErrorDeLaAplicacion({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const salir = useSalirAlAcceso();
  const sinSesion = esSinSesion(error);

  useEffect(() => {
    if (sinSesion) void salir();
  }, [sinSesion, salir]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[400px]">
        <Card>
          {sinSesion ? (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <LogOut size={22} strokeWidth={1.5} className="text-text-subtle" aria-hidden />
              <h1 className="text-[15px] font-semibold text-text">
                Tu sesión ha terminado
              </h1>
              <p className="max-w-[280px] text-[13px] text-text-muted">
                Te llevamos al acceso para que vuelvas a entrar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <TriangleAlert
                size={22}
                strokeWidth={1.5}
                className="text-text-subtle"
                aria-hidden
              />
              <h1 className="text-[15px] font-semibold text-text">
                Algo ha fallado
              </h1>
              <p className="max-w-[280px] text-[13px] text-text-muted">
                No se ha podido cargar esta pantalla. Vuelve a intentarlo.
              </p>
              <div className="mt-2 flex gap-2.5">
                <Button variant="primary" size="compact" onClick={() => retry()}>
                  Reintentar
                </Button>
                <Link
                  href="/hoy"
                  className="inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-5 text-[15px] font-medium text-text transition-colors hover:bg-surface-2"
                >
                  Ir a Hoy
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

/**
 * ¿Es el «sin sesión» de `convex/helpers.ts#requireUser`?
 *
 * Por el MOTIVO, nunca por el texto: en producción el texto no llega y el
 * `data` de un `ConvexError` sí. Espeja `esSinSesion` de `convex/helpers.ts`,
 * que no se puede importar aquí porque arrastra código de servidor.
 */
function esSinSesion(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const datos = error.data as { motivo?: unknown } | null;
  return datos?.motivo === "sin_sesion";
}
