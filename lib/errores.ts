import { ConvexError } from "convex/values";
import * as Sentry from "@sentry/nextjs";

/**
 * Lo que hay que contarle a Sentry de un fallo que la pantalla ya ha atrapado
 * — implementa JES-111.
 *
 * JES-110 dejó Sentry recogiendo lo que NADIE atrapa: errores al pintar,
 * excepciones sueltas y lo que falla en el servidor. Pero un `catch` que enseña
 * «No se ha podido guardar» se come el error, y ese es el fallo más habitual de
 * un CRM: el formulario que no guarda. Sin esto, en producción el usuario ve un
 * aviso y nadie se entera nunca.
 *
 * LA REGLA: un `ConvexError` con motivo es algo PREVISTO —contraseña
 * incorrecta, correo repetido, última Dueña— y no se reporta, porque llenaría
 * Sentry de cosas que funcionan como deben. Todo lo demás es inesperado y sí.
 *
 * Se decide por el MOTIVO, nunca por el texto: en producción Convex oculta el
 * mensaje de un error no controlado y manda «Server Error», así que el texto no
 * distingue nada. El `data` de un `ConvexError` sí llega. Es el mismo criterio
 * que `esSinSesion` en `app/error.tsx`.
 *
 * NADA DE AQUÍ LANZA NUNCA. El criterio 3 de la issue exige que el aviso que ve
 * la persona no cambie —ni el texto, ni cuándo aparece—, y un fallo al reportar
 * que se propagara cambiaría justamente eso: convertiría un «no se ha podido
 * guardar» en una pantalla de error. Misma regla, y por el mismo motivo, que
 * `convex/latido.ts`.
 */

/** El motivo que viaja en el `data` de un `ConvexError`, si es que lo hay. */
export function motivoDe(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const datos = error.data as { motivo?: unknown } | null | undefined;
  if (datos === null || typeof datos !== "object") return null;
  return typeof datos.motivo === "string" ? datos.motivo : null;
}

/**
 * Reporta a Sentry solo lo inesperado, y devuelve el motivo previsto si lo hay.
 *
 * Devuelve el motivo en vez de solo reportar porque tres pantallas ya lo
 * necesitaban para elegir su texto y tenían `motivoDe` copiado palabra por
 * palabra. Así esas tres cambian una línea y pierden su copia, en lugar de
 * ganar una llamada suelta al lado.
 *
 * `reportar` se puede inyectar para probar LA DECISIÓN sin enviar nada: lo que
 * el criterio 1 pide comprobar es a quién se reporta y a quién no, no que Sentry
 * esté configurado.
 */
export function motivoOReporta(
  error: unknown,
  reportar: (e: unknown) => void = Sentry.captureException,
): string | null {
  const motivo = motivoDe(error);
  if (motivo !== null) return motivo;

  try {
    reportar(error);
  } catch (fallo) {
    // Si ni Sentry funciona, esto es lo último que queda. Lo que NO puede pasar
    // es que se propague: ver la cabecera del fichero.
    const porque = fallo instanceof Error ? fallo.message : "fallo desconocido";
    console.warn(`No se ha podido reportar el error: ${porque}`);
  }

  return null;
}

/**
 * Los fallos PARCIALES, que no son excepciones y por eso ningún `catch` ve.
 *
 * Hay dos sitios donde el servidor devuelve un booleano en vez de rechazar: la
 * operación principal ha ido bien y algo de alrededor no. La pantalla lo cuenta
 * en su aviso, que se cierra al momento, y ahí se acaba el rastro.
 *
 * Y el rastro que dejan detrás NO es el mismo en los dos, conviene no
 * generalizarlo: `convex/equipo.ts` al menos apunta un `console.error` —en los
 * registros de Convex, que no mira nadie, el silencio que motivó JES-112—,
 * mientras que `convex/cuenta.ts` **no apunta nada**: su `catch` se limita a
 * poner el booleano en `false`. Ahí esto es el único rastro que va a existir.
 *
 * Lo encontró la auditoría, las dos veces: que la issue era más ancha que
 * «errores atrapados», y que yo había generalizado el `console.error`.
 */
export const FALLOS_PARCIALES = {
  /**
   * `convex/cuenta.ts#cambiarContrasena` devuelve `sesionesCerradas: false`.
   *
   * ES EL GRAVE DE LOS DOS: la contraseña queda cambiada pero las otras
   * sesiones siguen vivas, que es exactamente lo que uno cambia la contraseña
   * para evitar. Hoy solo se dice en un aviso que se cierra al momento.
   */
  sesiones_no_cerradas:
    "Contraseña cambiada, pero no se han podido cerrar las otras sesiones",

  /** `convex/equipo.ts#avisarAlta` devuelve `enviado: false`. */
  aviso_de_alta_no_enviado:
    "Usuario dado de alta, pero no se ha podido enviar el aviso por correo",
} as const;

export type FalloParcial = keyof typeof FALLOS_PARCIALES;

/**
 * Cuenta un fallo parcial. La operación principal ha ido bien.
 *
 * Va por `captureMessage` y no por `captureException` porque no hay excepción
 * que capturar: fabricar un `Error` sintético daría una traza que apunta a esta
 * línea y no al fallo, que es peor que no tenerla.
 *
 * OJO CON REPORTAR DOS VECES. Donde una llamada tenga además un `.catch` que
 * convierta el rechazo en ese mismo booleano, hay que reportar **una sola vez**:
 * la excepción si la hubo, y este mensaje solo si el `false` vino del servidor.
 * Ver `components/equipo/OverlayUsuario.tsx`. Lo pidió la auditoría.
 */
export function reportaFalloParcial(
  que: FalloParcial,
  reportar: (mensaje: string) => void = Sentry.captureMessage,
): void {
  try {
    reportar(FALLOS_PARCIALES[que]);
  } catch (fallo) {
    const porque = fallo instanceof Error ? fallo.message : "fallo desconocido";
    console.warn(`No se ha podido reportar el fallo parcial: ${porque}`);
  }
}
