import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Providers } from "./providers";
import { InlineScript, SCRIPT_DEL_TEMA } from "./InlineScript";
import "./globals.css";

/**
 * Inter para todo el texto, JetBrains Mono tabular para toda cifra.
 * Pesos 400/500/600 — el design system pide evitar el 700.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vibe CRM",
  description:
    "Organiza tus clientes y no pierdas ventas por falta de seguimiento.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vibe CRM",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Que la barra del sistema acompañe al lienzo en cada modo.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8F9" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F11" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // SOLO EN DESARROLLO: deja que una prueba llegue a `app/global-error.tsx`,
  // que de otro modo es inalcanzable. Una barrera de error no envuelve al
  // layout de su mismo segmento, así que no basta con que falle una ruta: tiene
  // que reventar ESTE componente. Ver `e2e/error-global.spec.ts`.
  //
  // En producción es código muerto: Next sustituye `process.env.NODE_ENV` al
  // compilar, así que la rama se elimina y `cookies()` no llega a llamarse.
  if (
    process.env.NODE_ENV !== "production" &&
    (await cookies()).has("forzar-fallo-raiz")
  ) {
    throw new Error("Fallo del layout raíz forzado por una prueba");
  }

  return (
    <ConvexAuthNextjsServerProvider>
      {/* `data-theme="light"` va en el JSX a propósito, no lo pone solo el
          script. En desarrollo React remonta una vez y repone el `<html>` a los
          atributos que gestiona desde aquí: si el valor por defecto no
          estuviera, el atributo desaparecería en vez de volver a «light».
          `TemaDelSistema` lo corrige después de hidratar. */}
      <html
        lang="es"
        data-theme="light"
        suppressHydrationWarning
        className={`${inter.variable} ${jetbrainsMono.variable}`}
      >
        <head>
          {/* Corre mientras el navegador analiza el HTML, antes del primer
              pintado: por eso no hay destello blanco al abrir en oscuro.
              Como todo script en línea, espera a que no quede ninguna hoja de
              estilos pendiente. No cuesta nada visible —esa hoja ya bloquea el
              pintado de todas formas—, pero una prueba que la retenga para
              siempre deja la página sin analizar: ver `e2e/acceso.spec.ts`. */}
          <InlineScript html={SCRIPT_DEL_TEMA} />
        </head>
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
