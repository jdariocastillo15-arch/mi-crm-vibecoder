"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TemaDelSistema } from "@/components/shell/TemaDelSistema";
import { InlineScript, SCRIPT_DEL_TEMA } from "./InlineScript";
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
 * SIGUE AL SISTEMA POR SU CUENTA, y tiene que hacerlo aquí dentro. Como
 * reemplaza al documento, el `data-theme` que pone `app/layout.tsx` no llega, y
 * `TemaDelSistema` tampoco, porque vive dentro de los proveedores. Lo dice Next
 * en `01-app/03-api-reference/03-file-conventions/error.md`: «global-error…
 * render their own document… so an app-level theme toggle won't reach them…
 * apply it inside your own global-error component».
 *
 * Por eso repite las tres piezas del layout: el script en línea antes del
 * primer pintado, el `data-theme` por defecto en el JSX —que el remontaje del
 * modo estricto repone— y `TemaDelSistema` para el resto. Lo pilló la auditoría
 * de JES-72 cuando todo lo demás ya estaba en verde.
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
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <InlineScript html={SCRIPT_DEL_TEMA} />
      </head>
      <body>
        <TemaDelSistema />
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
