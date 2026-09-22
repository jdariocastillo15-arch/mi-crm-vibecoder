import * as Sentry from "@sentry/nextjs";

/**
 * Los errores del servidor de Node — implementa parte de JES-110.
 *
 * Lo carga `instrumentation.ts` cuando arranca el servidor. Recoge lo que pasa
 * al pintar en servidor, en los route handlers y en las server actions.
 *
 * Mismos dos cerrojos que en el navegador: sin DSN no se manda nada, y fuera de
 * producción tampoco.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
});
