import * as Sentry from "@sentry/nextjs";

/**
 * Los errores del borde — implementa parte de JES-110.
 *
 * Hace falta porque `middleware.ts` no corre en Node, sino en el borde: es el
 * guardia de acceso de todas las rutas, y si falla ahí nadie entra. Se puede
 * comprobar en `.next/server/middleware-manifest.json` después de un build.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
});
