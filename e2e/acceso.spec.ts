import { continuarConCorreo, expect, test } from "./prueba";

/**
 * Sin sesión — implementa parte de JES-100.
 *
 * Estas pruebas NO usan la sesión guardada: vacían el estado para ser alguien
 * que llega de fuera.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const PROTEGIDAS = ["/hoy", "/clientes", "/ventas", "/equipo", "/cuenta"];

for (const ruta of PROTEGIDAS) {
  test(`${ruta} lleva al acceso`, async ({ page }) => {
    await page.goto(ruta);

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Inicia sesión" }),
    ).toBeVisible();
  });
}

test("un correo sin dominio completo se avisa sin salir del paso", async ({
  page,
}) => {
  await page.goto("/login");

  // Sin punto tras la arroba. El navegador lo da por bueno, así que el aviso
  // que se ve es el de la aplicación. Y no llega a preguntar al servidor.
  //
  // Que el campo conserve lo escrito es parte de la prueba: un campo vaciado
  // por la hidratación enseñaría el mismo aviso por otro motivo.
  await continuarConCorreo(page, "nombre@dominio", async (p) => {
    await expect(p.getByText("Introduce un email válido")).toBeVisible({
      timeout: 2_000,
    });
    await expect(p.getByLabel("Email", { exact: true })).toHaveValue(
      "nombre@dominio",
      { timeout: 0 },
    );
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Inicia sesión" }),
  ).toBeVisible();
});
