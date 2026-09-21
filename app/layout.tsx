import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Providers } from "./providers";
import { InlineScript } from "./InlineScript";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
          <InlineScript
            html={`(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.theme='dark'}}catch(e){}})()`}
          />
        </head>
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
