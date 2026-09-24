import { expect, test } from "@playwright/test";
import { ConvexError } from "convex/values";
import {
  FALLOS_PARCIALES,
  motivoDe,
  motivoOReporta,
  reportaFalloParcial,
} from "../lib/errores";

/**
 * El ayudante que decide qué llega a Sentry — criterio 1 de JES-111.
 *
 * Son pruebas de LÓGICA, sin navegador: no piden `page`, así que Playwright no
 * levanta ninguno. Mismo patrón que el barrido de emoji de `fidelidad.spec.ts`,
 * y por la misma razón: aquí no hay runner de unitarias y esto es lo que hay.
 *
 * Se usa el `test` de `@playwright/test` y no el de `./prueba`, porque ese trae
 * sesión y vigilancia de excepciones de página, y aquí no hay página.
 *
 * Se importa por ruta relativa a propósito: ninguna prueba de `e2e/` usa el
 * alias `@/`, así que no está probado que Playwright lo resuelva, y no es aquí
 * donde toca averiguarlo.
 *
 * LO QUE SE AFIRMA es la decisión —a quién se reporta y a quién no—, con un
 * espía inyectado. Que Sentry esté bien configurado es cosa de JES-110.
 */

/** Un espía que apunta con qué se le ha llamado. */
function espia() {
  const visto: unknown[] = [];
  return { visto, reportar: (x: unknown) => void visto.push(x) };
}

// ---------------------------------------------------------------------------
// Lo previsto NO se reporta
// ---------------------------------------------------------------------------

test("un ConvexError con motivo no se reporta, y devuelve el motivo", () => {
  const { visto, reportar } = espia();
  const error = new ConvexError({ motivo: "ultima_duena" });

  expect(motivoOReporta(error, reportar)).toBe("ultima_duena");
  expect(visto, "un fallo previsto no debe llegar a Sentry").toEqual([]);
});

// ---------------------------------------------------------------------------
// Lo inesperado SÍ
// ---------------------------------------------------------------------------

test("un Error pelado se reporta una vez, y devuelve null", () => {
  const { visto, reportar } = espia();
  const error = new Error("Server Error");

  expect(motivoOReporta(error, reportar)).toBeNull();
  expect(visto).toEqual([error]);
});

/**
 * El caso que de verdad sostiene la regla.
 *
 * En producción Convex sustituye el mensaje de un error no controlado por
 * «Server Error». Si la decisión mirara el texto, esto pasaría por previsto y no
 * se reportaría nunca: justo el fallo que la issue existe para ver.
 */
test("un ConvexError SIN motivo se reporta: no basta con ser ConvexError", () => {
  const { visto, reportar } = espia();

  for (const error of [
    new ConvexError("Server Error"),
    new ConvexError({ otra: "cosa" }),
    new ConvexError({ motivo: 42 }),
  ]) {
    expect(motivoOReporta(error, reportar)).toBeNull();
  }

  expect(visto).toHaveLength(3);
});

test("motivoDe no confunde lo que no es un ConvexError", () => {
  expect(motivoDe(new Error("x"))).toBeNull();
  expect(motivoDe("una cadena")).toBeNull();
  expect(motivoDe(null)).toBeNull();
  expect(motivoDe(undefined)).toBeNull();
});

// ---------------------------------------------------------------------------
// Los fallos parciales
// ---------------------------------------------------------------------------

test("un fallo parcial se cuenta una vez, con su texto", () => {
  const { visto, reportar } = espia();

  reportaFalloParcial("sesiones_no_cerradas", reportar);

  expect(visto).toEqual([FALLOS_PARCIALES.sesiones_no_cerradas]);
});

// ---------------------------------------------------------------------------
// El criterio 3: reportar no puede cambiar lo que ve la persona
// ---------------------------------------------------------------------------

/**
 * Si esto fallara, un Sentry caído convertiría un aviso de «no se ha podido
 * guardar» en una pantalla de error. Lo pidió la auditoría para las dos
 * funciones, no solo para una.
 */
test("un reportero que revienta no se propaga, en ninguna de las dos", () => {
  const revienta = () => {
    throw new Error("Sentry no está");
  };

  expect(() => motivoOReporta(new Error("x"), revienta)).not.toThrow();
  expect(motivoOReporta(new Error("x"), revienta)).toBeNull();

  expect(() =>
    reportaFalloParcial("aviso_de_alta_no_enviado", revienta),
  ).not.toThrow();

  // Y con un fallo previsto ni se llega a llamar al reportero, así que tampoco.
  expect(
    motivoOReporta(new ConvexError({ motivo: "sin_sesion" }), revienta),
  ).toBe("sin_sesion");
});
