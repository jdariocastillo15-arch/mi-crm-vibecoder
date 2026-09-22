import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

/**
 * Sentry envuelve la configuración — implementa parte de JES-110.
 *
 * Además de enchufar el SDK, el envoltorio hace dos cosas:
 *
 * · SUBE LOS SOURCE MAPS al construir, para que una pila de producción se lea
 *   con los nombres del código y no con los del minificado. Lo único que hace
 *   falta es SENTRY_AUTH_TOKEN, que solo está puesto en Railway: sin él el
 *   build pasa igual, pero no sube nada. La organización y el proyecto van
 *   escritos aquí y no en variables, porque no son secretos —salen de la URL
 *   del panel— y así hay dos cosas menos que mantener. Los mapas del navegador
 *   no se quedan en el build, así que el código sin minificar no acaba
 *   servido.
 *
 * · EL TÚNEL. Los eventos salen por `/registro-de-errores`, una ruta del propio
 *   dominio, en vez de ir directos a Sentry, que es una dirección que bastantes
 *   bloqueadores cortan. A cambio, `middleware.ts` tiene que dejar esa ruta
 *   fuera de su guardia, y eso lo vigila `e2e/monitorizacion.spec.ts`.
 *
 * La versión que se ve en Sentry sale sola del commit: el plugin lee
 * `RAILWAY_GIT_COMMIT_SHA`.
 *
 * Las opciones `bundleSizeOptimizations` del SDK se probaron el 22-sep y no
 * recortaban ni un kB con Turbopack, así que no están: serían ruido.
 */
export default withSentryConfig(nextConfig, {
  org: "jesus-qx",
  project: "vibe-crm",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/registro-de-errores",
  // De nuestros builds no sale nada hacia Sentry que no sean los mapas.
  telemetry: false,
  // Callado cuando no hay nada que subir —un build local sin token— y hablador
  // cuando sí lo hay, que es en Railway: ahí el registro del build es la única
  // forma de ver si los mapas llegaron.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Una herramienta de vigilancia no puede tumbar un despliegue: si algo falla
  // al preparar o subir los mapas, queda avisado en el registro y el build
  // sigue. El coste de equivocarse aquí es una pila minificada, no una caída.
  errorHandler: (error) => {
    console.warn(`[sentry] no se pudieron subir los source maps: ${error.message}`);
  },
});
