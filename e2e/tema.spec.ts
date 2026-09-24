import { expect, test } from "./prueba";

/**
 * El modo claro y oscuro siguen al sistema — implementa JES-72.
 *
 * Playwright emula `prefers-color-scheme`, así que esto comprueba el mecanismo
 * de verdad y no a mano.
 *
 * TODAS ESPERAN `data-tema-listo` ANTES DE AFIRMAR, y no es una precaución
 * vacía: el script de `layout.tsx` pone el atributo al analizar el HTML, pero en
 * desarrollo el modo estricto de React remonta una vez y lo borra. Sin esperar a
 * que `TemaDelSistema` lo reponga, la prueba mediría el estado anterior al
 * remontaje y pasaría en verde sin comprobar lo que importa.
 */

const LIENZO_OSCURO = "rgb(14, 15, 17)"; //  --color-bg en oscuro, #0e0f11
const LIENZO_CLARO = "rgb(247, 248, 249)"; // --color-bg en claro,  #f7f8f9

test.describe("con el sistema en oscuro", () => {
  test.use({ colorScheme: "dark" });

  test("la aplicación arranca en oscuro y sigue en oscuro tras hidratar", async ({
    page,
  }) => {
    await page.goto("/hoy");
    await expect(page.locator("html")).toHaveAttribute("data-tema-listo", "1");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", LIENZO_OSCURO);
  });
});

test.describe("con el sistema en claro", () => {
  test.use({ colorScheme: "light" });

  test("la aplicación arranca en claro", async ({ page }) => {
    await page.goto("/hoy");
    await expect(page.locator("html")).toHaveAttribute("data-tema-listo", "1");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("body")).toHaveCSS("background-color", LIENZO_CLARO);
  });

  test("cambiar la preferencia del sistema cambia el modo sin recargar", async ({
    page,
  }) => {
    await page.goto("/hoy");
    await expect(page.locator("html")).toHaveAttribute("data-tema-listo", "1");
    await expect(page.locator("body")).toHaveCSS("background-color", LIENZO_CLARO);

    // Sin `goto` ni `reload`: esto solo puede funcionar si la suscripción de
    // `TemaDelSistema` sigue viva. Una sola transición basta, porque las dos
    // ramas pasan por la misma función.
    await page.emulateMedia({ colorScheme: "dark" });

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", LIENZO_OSCURO);
  });
});
