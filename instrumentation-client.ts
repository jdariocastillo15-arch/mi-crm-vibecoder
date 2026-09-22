import * as Sentry from "@sentry/nextjs";

/**
 * Los errores del navegador — implementa parte de JES-110.
 *
 * Next ejecuta este fichero cuando el documento ya está cargado y ANTES de
 * hidratar, así que el recogedor está puesto desde antes de que corra el primer
 * código de la aplicación.
 *
 * DOS CERROJOS PARA NO ENVIAR NADA DESDE DESARROLLO. Sin DSN el SDK no manda
 * nada, y `enabled` lo corta igual aunque alguien tenga el DSN en su
 * `.env.local`. Las pruebas de Playwright corren contra `next dev`: ni deben
 * gastar cuota ni ensuciar el panel con errores provocados a propósito.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  // El CRM enseña datos de clientes. Con esto fuera, Sentry no guarda ni la IP,
  // ni las cookies, ni las cabeceras de sesión de quien sufrió el error.
  sendDefaultPii: false,
});

/**
 * Sin esto, el SDK avisa en cada build con un «ACTION REQUIRED». No mide nada
 * mientras no haya trazas activadas —que es el caso—, pero deja el registro del
 * build limpio para que se vea lo que sí importa.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
