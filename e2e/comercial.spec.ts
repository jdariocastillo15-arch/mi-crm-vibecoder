import { expect, test } from "./prueba";
import { SESION_COMERCIAL } from "./sesion";

/**
 * Lo que cambia con el rol comercial — implementa parte de JES-100.
 *
 * El rol solo decide una cosa: si existe la pantalla de Equipo
 * (`convex/schema.ts`). Todo lo demás es igual para los dos roles y ya lo
 * recorre `pantallas.spec.ts` con la cuenta propietaria.
 */
test.use({ storageState: SESION_COMERCIAL });

test("Equipo no se ofrece, y tecleando la URL se explica por qué", async ({
  page,
}) => {
  await page.goto("/equipo");

  // Este aviso solo sale cuando ya se sabe quién eres: mientras carga, la
  // pantalla no decide nada. Por eso va primero. Sin él, que falte «Equipo» en
  // la navegación no probaría nada, porque tampoco está mientras carga.
  await expect(
    page.getByRole("heading", { name: "Acceso restringido" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Añadir usuario" })).toHaveCount(0);

  for (const destino of ["Hoy", "Clientes", "Ventas"]) {
    await expect(
      page.getByRole("link", { name: destino, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Equipo", exact: true })).toHaveCount(0);
});

test("Mi cuenta enseña el rol comercial", async ({ page }) => {
  await page.goto("/cuenta");

  // Dentro de <main>: en escritorio la barra lateral repite el rol.
  const contenido = page.getByRole("main");
  await expect(contenido.getByText("Atiende y vende", { exact: true })).toBeVisible();
  await expect(
    contenido
      .getByText(process.env.E2E_COMERCIAL_EMAIL ?? "", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
});
