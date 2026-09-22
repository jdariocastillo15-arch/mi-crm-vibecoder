import { expect, test } from "./prueba";

/**
 * El túnel de errores no pasa por el guardia del acceso — implementa parte de
 * JES-110.
 *
 * El navegador manda los errores a `/registro-de-errores`, que `next.config.ts`
 * reescribe hacia Sentry para que no los corte un bloqueador. Esa ruta no lleva
 * punto, así que el `matcher` de `middleware.ts` la atraparía como a cualquier
 * pantalla: sin sesión, el guardia la mandaría a `/login` y se perderían en
 * silencio justo los errores de la pantalla de acceso, que es donde nadie tiene
 * sesión todavía.
 *
 * Esto no comprueba que Sentry conteste —no hay cuenta en las pruebas— sino lo
 * único que puede romper este repositorio: que la petición acabe en el acceso.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("el túnel de errores no acaba en el acceso", async ({ page }) => {
  const respuesta = await page.request.get("/registro-de-errores");

  expect(respuesta.url()).not.toContain("/login");
});
