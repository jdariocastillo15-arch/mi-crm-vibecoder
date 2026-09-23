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

test("el correo escrito antes de que cargue la página no se pierde", async ({
  page,
}) => {
  // Se retienen los scripts mientras se escribe: así la escritura ocurre, seguro,
  // antes de que React hidrate la pantalla. Escribir «al instante» no lo
  // garantiza.
  let soltar: () => void = () => {};
  const retenidos = new Promise<void>((resolver) => {
    soltar = resolver;
  });
  // SOLO el JavaScript, y el `.js` importa. Bajo `chunks/` vive también la hoja
  // de estilos, y reteniéndola el navegador no puede ejecutar el script en línea
  // del tema —uno en línea espera a que no queden hojas pendientes, porque
  // podría consultar estilos calculados—, así que el análisis del HTML se para
  // y la pantalla no llega a existir. El comentario de arriba ya decía «se
  // retienen los scripts»: esto es acotarlo a lo que siempre quiso decir.
  let retenidosVistos = 0;
  await page.route("**/_next/static/chunks/**.js", async (ruta) => {
    retenidosVistos += 1;
    await retenidos;
    await ruta.continue();
  });

  await page.goto("/login", { waitUntil: "commit" });
  // Que el patrón de arriba siga casando con algo. Si Next cambiara dónde
  // publica sus paquetes, no se retendría nada, la hidratación no se retrasaría
  // y esta prueba seguiría en verde sin comprobar ya lo que dice comprobar.
  await expect.poll(() => retenidosVistos).toBeGreaterThan(0);

  const campo = page.getByLabel("Email", { exact: true });
  // `.test` está reservado para pruebas (RFC 6761): ese dominio no existe ni
  // existirá, así que ningún correo puede llegar a nadie de verdad.
  const escrito = "  Nadie.Prueba@Ejemplo.TEST ";
  await campo.fill(escrito);
  soltar();

  // Cuándo ha hidratado: React marca cada nodo que gestiona. Es un detalle
  // interno, y aquí solo sirve para saber cuándo mirar; el margen de después
  // deja terminar la hidratación, que es donde se borraba lo escrito.
  await expect
    .poll(() =>
      campo.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))),
    )
    .toBe(true);
  await page.waitForTimeout(1_000);
  // Sin los espacios de los extremos: en un campo `type="email"` los quita el
  // propio navegador, por la sanitización de valores de HTML. Las mayúsculas
  // siguen ahí, y las normaliza la aplicación al enviar.
  await expect(campo).toHaveValue(escrito.trim());

  // Y lo escrito llega de verdad, normalizado. Un correo desconocido no dispara
  // nada en el servidor (`convex/acceso.ts`).
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Elige tu contraseña" })).toBeVisible();
  await expect(
    page.getByText("Te hemos enviado un código a nadie.prueba@ejemplo.test.", {
      exact: false,
    }),
  ).toBeVisible();
});
