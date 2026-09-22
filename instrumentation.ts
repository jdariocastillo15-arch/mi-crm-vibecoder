import * as Sentry from "@sentry/nextjs";

/**
 * El arranque de Sentry en el servidor — implementa parte de JES-110.
 *
 * `register()` corre una sola vez por instancia del servidor, antes de atender
 * la primera petición. Hay dos configuraciones porque hay dos entornos, y cada
 * uno trae su propio SDK: Node para la aplicación y el borde para el
 * middleware.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Lo que Next llama cuando recoge un error del servidor. Es la única forma de
 * enterarse de lo que revienta al pintar en servidor, en un route handler, en
 * una server action o en el propio middleware: esos errores nunca llegan al
 * navegador con su pila, solo con un `digest`.
 */
export const onRequestError = Sentry.captureRequestError;
