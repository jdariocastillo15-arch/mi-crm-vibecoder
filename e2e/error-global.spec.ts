import { expect, test } from "@playwright/test";

/**
 * La pantalla de último recurso sigue al sistema — cierra el hallazgo M1 de la
 * auditoría de JES-72.
 *
 * `app/global-error.tsx` REEMPLAZA AL DOCUMENTO cuando revienta el layout raíz,
 * así que no pasa por `app/layout.tsx`, ni por `Providers`, ni por
 * `TemaDelSistema`: el tema hay que aplicarlo dentro. Lo dice Next en
 * `01-app/03-api-reference/03-file-conventions/error.md`, y se coló entera
 * porque esa pantalla la añadió JES-110 después de abrir esta rama.
 *
 * FICHERO APARTE Y CON EL `test` DE PLAYWRIGHT, no con el del proyecto. Es la
 * única prueba del repositorio que necesita que la página lance una excepción,
 * y `e2e/prueba.ts` hace fallar cualquiera en la que eso ocurra —con razón, en
 * todas las demás—. Lo que sí se pierde con el `test` base es que se esconda la
 * superposición de desarrollo; aquí da igual, porque nada se pulsa.
 *
 * El fallo lo provoca una cookie que `app/layout.tsx` solo mira fuera de
 * producción. Que esto se pueda ver en desarrollo no es casualidad: Next lo
 * anota en su registro de cambios, «v15.2.0 — Also display global-error in
 * development», y aquí vamos por la 16.3.5.
 */

const LIENZO_OSCURO = "rgb(14, 15, 17)"; // --color-bg en oscuro, #0e0f11

test.use({ colorScheme: "dark" });

test("la pantalla de error global sale en oscuro con el sistema en oscuro", async ({
  page,
  baseURL,
}) => {
  await page.context().addCookies([
    { name: "forzar-fallo-raiz", value: "1", url: baseURL! },
  ]);

  await page.goto("/hoy");

  // PRIMERO, que estamos de verdad en la pantalla de error. Sin esto los tres
  // afirmados de abajo también pasarían en una pantalla normal el día que la
  // cookie dejara de provocar el fallo, y la prueba se quedaría en verde sin
  // mirar ya nada.
  await expect(
    page.getByRole("heading", { level: 1, name: "Algo ha fallado" }),
  ).toBeVisible();

  await expect(page.locator("html")).toHaveAttribute("data-tema-listo", "1");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", LIENZO_OSCURO);
});
