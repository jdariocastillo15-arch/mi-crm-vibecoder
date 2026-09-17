import type { Page } from "@playwright/test";
import { expect, test } from "./prueba";

/**
 * Recorrido por todas las pantallas con sesión — implementa parte de JES-100.
 *
 * SOLO LEE. Ninguna prueba de este fichero guarda nada: abre pantallas, escribe
 * en el buscador y mira lo que se enseña. Las que escriban datos irán aparte,
 * cuando se decida dónde viven los de prueba.
 *
 * Entra con la cuenta propietaria, que es la que ve las cuatro pantallas. Lo
 * que cambia con el rol comercial está en `comercial.spec.ts`.
 *
 * Corre dos veces, en escritorio y en móvil. La navegación se busca por rol y
 * nombre, y `getByRole` descarta lo que está oculto: en móvil encuentra la
 * barra de pestañas y en escritorio la lateral, sin distinguirlas a mano.
 */

/** El título de la barra superior, que es el único <h1> de cada pantalla. */
function titulo(page: Page, texto: string) {
  return page.getByRole("heading", { level: 1, name: texto, exact: true });
}

test("la navegación principal lleva a cada pantalla", async ({ page }) => {
  await page.goto("/hoy");

  for (const destino of ["Clientes", "Ventas", "Equipo", "Hoy"]) {
    const enlace = page.getByRole("link", { name: destino, exact: true });
    await enlace.click();

    await expect(page).toHaveURL(new RegExp(`/${destino.toLowerCase()}$`));
    await expect(titulo(page, destino)).toBeVisible();
    await expect(enlace).toHaveAttribute("aria-current", "page");
  }
});

test("Hoy enseña el titular y las cuatro acciones rápidas", async ({ page }) => {
  await page.goto("/hoy");

  await expect(titulo(page, "Hoy")).toBeVisible();
  await expect(page.getByText(/^(Todo al día|\d+ seguimientos?)$/)).toBeVisible();

  // `first()` porque sin seguimientos para hoy el estado vacío trae su propio
  // botón «Nueva tarea».
  for (const accion of [
    "Nueva tarea",
    "Anotar interacción",
    "Registrar venta",
    "Nuevo cliente",
  ]) {
    await expect(
      page.getByRole("button", { name: accion, exact: true }).first(),
    ).toBeVisible();
  }
});

test("Clientes filtra en vivo y abre la ficha", async ({ page, isMobile }) => {
  await page.goto("/clientes");
  await expect(titulo(page, "Clientes")).toBeVisible();

  const filas = page.locator('a[href^="/clientes/"]');
  await expect(filas.first()).toBeVisible();

  // El nombre es el primer texto de la fila; el avatar va aparte y oculto.
  const nombre = await filas.first().locator(":scope > div > span").first().innerText();

  const buscador = page.getByLabel("Buscar clientes");
  await buscador.fill(nombre);
  await expect(filas.filter({ hasText: nombre }).first()).toBeVisible();
  await expect(page.getByText(/^\d+ resultados?$/)).toBeVisible();

  await buscador.fill("zzzz sin coincidencias zzzz");
  await expect(page.getByText("Sin resultados", { exact: true })).toBeVisible();
  await expect(filas).toHaveCount(0);

  await buscador.fill("");
  await expect(page.getByText(/^\d+ clientes?$/)).toBeVisible();

  await filas.filter({ hasText: nombre }).first().click();
  await expect(page).toHaveURL(/\/clientes\/[^/]+$/);
  await expect(titulo(page, nombre)).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar", exact: true })).toBeVisible();

  // La ficha va a pantalla completa: en móvil se esconden las pestañas.
  const pestanas = page.getByRole("navigation", { name: "Navegación principal" });
  if (isMobile) await expect(pestanas).toBeHidden();

  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(titulo(page, "Clientes")).toBeVisible();
});

test("Clientes abre el alta si se carga con ?nuevo=1", async ({ page }) => {
  // Pasa al recargar con el formulario abierto, o con un enlace guardado. Antes
  // no se abría, y el botón «Nuevo cliente» de la barra dejaba de responder
  // porque la URL ya era esa.
  await page.goto("/clientes?nuevo=1");

  const dialogo = page.getByRole("dialog", { name: "Nuevo cliente" });
  await expect(dialogo).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(page).toHaveURL(/\/clientes$/);
});

test("Editar cliente no deja quitar todo medio de contacto", async ({ page }) => {
  // Un guardado que se colara borraría el contacto de un cliente de verdad. Se
  // cortan en el WebSocket las llamadas a `clientes:actualizar`: si la regla se
  // rompiera, la prueba fallaría sin haber tocado ningún dato.
  let guardadosCortados = 0;
  await page.routeWebSocket(/\.convex\.cloud\//, (ws) => {
    const servidor = ws.connectToServer();
    ws.onMessage((mensaje) => {
      if (String(mensaje).includes('"clientes:actualizar"')) guardadosCortados += 1;
      else servidor.send(mensaje);
    });
  });

  await page.goto("/clientes");
  await page.locator('a[href^="/clientes/"]').first().click();
  await expect(page).toHaveURL(/\/clientes\/[^/]+$/);
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Editar cliente" });
  await expect(dialogo).toBeVisible();

  // Espacios en el email: también cuentan como vacío.
  await dialogo.getByLabel("Teléfono").fill("");
  await dialogo.getByLabel("Email").fill("   ");
  await dialogo.getByRole("button", { name: "Guardar" }).click();

  await expect(dialogo).toBeVisible();
  await expect(
    dialogo.getByText("Indica al menos un teléfono o un email"),
  ).toHaveCSS("color", "rgb(153, 27, 27)");
  expect(guardadosCortados).toBe(0);

  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();
});

test("Ventas enseña las dos cifras, el filtro y el alta", async ({ page }) => {
  await page.goto("/ventas");

  await expect(titulo(page, "Ventas")).toBeVisible();
  await expect(page.getByText("En marcha", { exact: true })).toBeVisible();
  await expect(page.getByText("Ganado", { exact: true })).toBeVisible();

  const filtro = page.getByRole("radiogroup", { name: "Filtrar ventas por estado" });
  await expect(filtro).toBeVisible();
  await expect(filtro.getByRole("radio")).toHaveCount(4);

  await expect(page.getByRole("button", { name: "Añadir venta" })).toBeVisible();
});

test("Equipo enseña el recuento y el alta a la propietaria", async ({ page }) => {
  await page.goto("/equipo");

  await expect(titulo(page, "Equipo")).toBeVisible();
  await expect(page.getByText(/^\d+ usuarios?$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Añadir usuario" })).toBeVisible();
});

test("Mi cuenta enseña quién ha entrado y sus opciones", async ({ page }) => {
  await page.goto("/cuenta");

  await expect(titulo(page, "Mi cuenta")).toBeVisible();
  // Solo el visible: el formulario de «Editar mis datos» también lo lleva,
  // cerrado y fuera de la vista.
  await expect(
    page
      .getByText(process.env.E2E_PROPIETARIA_EMAIL ?? "", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();

  // Dentro de <main>: en escritorio la barra lateral tiene su propio botón de
  // cerrar sesión. Y este NO se pulsa: revocaría la sesión que comparten todas
  // las pruebas.
  const contenido = page.getByRole("main");
  await expect(contenido.getByRole("button", { name: "Editar mis datos" })).toBeVisible();
  await expect(contenido.getByRole("button", { name: "Cambiar contraseña" })).toBeVisible();
  await expect(contenido.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});
