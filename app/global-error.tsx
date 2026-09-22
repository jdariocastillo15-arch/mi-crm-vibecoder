"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import "./globals.css";

/**
 * El último recurso: falla el propio layout raíz — implementa parte de JES-110.
 *
 * `app/error.tsx` no puede recoger esto. Una barrera de error no envuelve al
 * layout de su mismo segmento, así que si lo que revienta es `RootLayout` —el
 * proveedor de Convex, las fuentes, el propio `<html>`— Next sustituye el
 * documento entero por este fichero. Hasta ahora no existía: se veía la
 * pantalla por defecto de Next, en inglés, y el fallo no quedaba registrado en
 * ningún sitio.
 *
 * REEMPLAZA AL DOCUMENTO, por eso trae su propio `<html>` y su `<body>` y tiene
 * que importar `globals.css` a mano: los estilos del layout raíz no llegan
 * aquí.
 *
 * SIEMPRE EN CLARO, a diferencia del resto de pantallas cuando entre JES-72: el
 * `data-theme` lo pone un componente que vive dentro de los proveedores, y aquí
 * no se monta ninguno. Habrá que montarlo también aquí para que esta pantalla
 * siga al sistema como las demás.
 */
export default function ErrorGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
          <div className="w-full max-w-100">
            <Card>
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
                <p className="max-w-70 text-[13px] text-text-muted">
                  No se ha podido cargar la aplicación. Vuelve a intentarlo.
                </p>
                <div className="mt-2">
                  <Button variant="primary" size="compact" onClick={() => retry()}>
                    Reintentar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </body>
    </html>
  );
}
