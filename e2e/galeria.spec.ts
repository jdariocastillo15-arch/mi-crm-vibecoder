import { expect, test } from "./prueba";

/**
 * La galería de componentes — implementa el criterio 2 de JES-41.
 *
 * Prueba los nueve estados en un navegador de verdad, sobre VALORES CALCULADOS
 * y sobre SEMÁNTICA, no sobre cadenas de clases. Esa es la razón de que el
 * criterio se cierre con Playwright y no instalando jsdom: allí `toHaveCSS` no
 * existe, porque no se calcula CSS.
 *
 * ANÓNIMA A PROPÓSITO. `/galeria` es pública, así que estas pruebas vacían el
 * estado de sesión: así comprueban de verdad el acceso sin entrar, y de paso no
 * dependen de los ficheros de `e2e/.auth/`, que caducan al estrenarse.
 *
 * Ojo: vaciar `storageState` hace anónima la prueba, pero los proyectos
 * `escritorio` y `movil` siguen dependiendo de `sesion` en la configuración, así
 * que `sesion.setup.ts` se ejecuta igual antes de esta tanda.
 */

test.use({ storageState: { cookies: [], origins: [] } });

/** Los mismos de `e2e/tema.spec.ts`: `--color-bg` en cada modo. */
const LIENZO_OSCURO = "rgb(14, 15, 17)"; //  #0e0f11
const LIENZO_CLARO = "rgb(247, 248, 249)"; // #f7f8f9

/** Los mismos nueve de `app/galeria/Galeria.tsx`, en el mismo orden. */
const ESTADOS = [
  "reposo",
  "hover",
  "foco",
  "pulsado",
  "deshabilitado",
  "error",
  "cargando",
  "vacio",
  "seleccionado",
] as const;

const INTERACTIVOS = [
  "button",
  "iconbutton",
  "input",
  "textarea",
  "select",
  "checkbox",
  "chips",
  "listrow",
  "tabbar",
  "overlay",
] as const;

test("la galería se abre sin sesión y no redirige", async ({ page }) => {
  await page.goto("/galeria");
  await expect(page).toHaveURL(/\/galeria$/);
  // La URL sola no basta: confirma que no hubo redirección, no que se pintara
  // la página correcta. Esto segundo sí es exclusivo de la galería.
  await expect(
    page.getByRole("heading", { name: "Galería de componentes", exact: true }),
  ).toBeVisible();
});

test("ningún estado se queda sin demostración ni razón", async ({ page }) => {
  await page.goto("/galeria");

  for (const componente of INTERACTIVOS) {
    for (const estado of ESTADOS) {
      const celda = page.getByTestId(`${componente}-${estado}`);
      await expect(celda, `${componente} · ${estado}`).toHaveCount(1);
      // "hueco" es lo que pinta la galería cuando falta una celda. Si aparece,
      // es que alguien añadió un estado y no lo resolvió.
      await expect(celda, `${componente} · ${estado}`).toHaveAttribute(
        "data-tipo",
        /^(demo|razon)$/,
      );
    }
  }
});

test("Button: alto, foco, pulsado, deshabilitado y cargando", async ({ page }) => {
  await page.goto("/galeria");

  const reposo = page.getByTestId("button-reposo").getByRole("button");
  await expect(reposo).toHaveCSS("height", "48px");

  // El anillo de foco es la sombra compuesta de --focus-ring, resuelta.
  const foco = page.getByTestId("button-foco").getByRole("button");
  await foco.focus();
  await expect(foco).toHaveCSS(
    "box-shadow",
    "rgb(255, 255, 255) 0px 0px 0px 2px, rgb(21, 128, 61) 0px 0px 0px 4px",
  );

  // El pulsado solo existe mientras el puntero está abajo: hay que afirmarlo
  // ANTES de soltar. El paquete baja el primario un píxel al pulsarlo.
  const pulsado = page.getByTestId("button-pulsado").getByRole("button");
  const caja = await pulsado.boundingBox();
  if (!caja) throw new Error("El botón de la celda «pulsado» no tiene caja");
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  // Tailwind v4 escribe la propiedad `translate`, no `transform`:
  // `.active\:translate-y-px:active { translate: var(--tw-translate-x) var(--tw-translate-y) }`.
  await expect(pulsado).toHaveCSS("translate", "0px 1px");
  await page.mouse.up();

  const apagado = page.getByTestId("button-deshabilitado").getByRole("button");
  await expect(apagado).toBeDisabled();

  const cargando = page.getByTestId("button-cargando").getByRole("button");
  await expect(cargando).toHaveAttribute("aria-busy", "true");
  await expect(cargando).toBeDisabled();
});

test("IconButton: mide 48px y se apaga", async ({ page }) => {
  await page.goto("/galeria");

  const reposo = page.getByTestId("iconbutton-reposo").getByRole("button");
  await expect(reposo).toHaveCSS("height", "48px");
  await expect(reposo).toHaveCSS("width", "48px");

  await expect(
    page.getByTestId("iconbutton-deshabilitado").getByRole("button"),
  ).toBeDisabled();
});

test("Input: error, deshabilitado y su semántica", async ({ page }) => {
  await page.goto("/galeria");

  const conError = page.getByTestId("input-error").getByRole("textbox");
  await expect(conError).toHaveAttribute("aria-invalid", "true");
  await expect(conError).toHaveAttribute("aria-describedby", /.+/);
  await expect(page.getByTestId("input-error").getByText("Formato no válido")).toBeVisible();

  await expect(page.getByTestId("input-deshabilitado").getByRole("textbox")).toBeDisabled();
  await expect(page.getByTestId("input-reposo").getByRole("textbox")).toHaveCSS(
    "height",
    "48px",
  );
});

test("Select y Textarea: alto, error y deshabilitado", async ({ page }) => {
  await page.goto("/galeria");

  await expect(page.getByTestId("select-reposo").getByRole("combobox")).toHaveCSS(
    "height",
    "48px",
  );
  await expect(page.getByTestId("select-deshabilitado").getByRole("combobox")).toBeDisabled();
  await expect(page.getByTestId("select-error").getByRole("combobox")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  await expect(page.getByTestId("textarea-deshabilitado").getByRole("textbox")).toBeDisabled();
  await expect(page.getByTestId("textarea-error").getByRole("textbox")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("Checkbox: objetivo táctil, marcado y deshabilitado que no llama", async ({ page }) => {
  await page.goto("/galeria");

  const sinMarcar = page.getByTestId("checkbox-reposo").getByRole("checkbox");
  await expect(sinMarcar).toHaveCSS("height", "44px");
  await expect(sinMarcar).toHaveCSS("width", "44px");
  await expect(sinMarcar).toHaveAttribute("aria-checked", "false");

  // El único con estado propio. Arranca marcada, porque su celda documenta el
  // estado «seleccionado» y tiene que enseñarlo sin que nadie haga nada.
  const alterna = page.getByTestId("checkbox-seleccionado").getByRole("checkbox");
  await expect(alterna).toHaveAttribute("aria-checked", "true");
  await alterna.click();
  await expect(alterna).toHaveAttribute("aria-checked", "false");

  // Lo que importa del deshabilitado no es cómo se ve, sino que NO llama al
  // callback. Si lo llamara, alternaría igual que el de arriba.
  const apagada = page.getByTestId("checkbox-deshabilitado").getByRole("checkbox");
  await expect(apagada).toBeDisabled();
  await apagada.click({ force: true });
  await expect(apagada).toHaveAttribute("aria-checked", "false");
});

test("Chips: la opción activa se anuncia y el error se enlaza", async ({ page }) => {
  await page.goto("/galeria");

  const grupo = page.getByTestId("chips-reposo");
  await expect(grupo.getByRole("radio", { name: "Abierta" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(grupo.getByRole("radio", { name: "Ganada" })).toHaveAttribute(
    "aria-checked",
    "false",
  );

  await grupo.getByRole("radio", { name: "Ganada" }).click();
  await expect(grupo.getByRole("radio", { name: "Ganada" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await expect(page.getByTestId("chips-error").getByText("Elige un estado")).toBeVisible();
});

test("ListRow: la fila seleccionada usa surface-2", async ({ page }) => {
  await page.goto("/galeria");

  // El contrato del paquete: `selected || hover ? surface-2 : transparent`.
  await expect(page.getByTestId("listrow-seleccionado").locator("> *")).toHaveCSS(
    "background-color",
    "rgb(241, 242, 244)",
  );
  // Y la de reposo NO lo lleva, que es lo que hace significativa la anterior.
  await expect(page.getByTestId("listrow-reposo").locator("> *")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
});

test("TabBar: el destino activo se marca y se anuncia", async ({ page, isMobile }) => {
  await page.goto("/galeria");

  const activa = page.getByTestId("tabbar-seleccionado");
  await expect(activa.getByRole("link", { name: "Ventas" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(activa.getByRole("link", { name: "Hoy" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  // El alto mínimo de cada destino solo se puede medir donde la barra se ve.
  if (isMobile) {
    const alto = await activa.getByRole("link", { name: "Hoy" }).boundingBox();
    expect(alto?.height ?? 0).toBeGreaterThanOrEqual(56);
  }
});

test("Overlay: atrapa el foco al abrirse", async ({ page }) => {
  await page.goto("/galeria");

  await page.getByTestId("overlay-reposo").getByRole("button").click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  // El foco entra al primer campo, que es el contrato de este overlay.
  await expect(dialogo.getByRole("textbox")).toBeFocused();
});

test("el modo oscuro cambia el lienzo", async ({ page }) => {
  await page.goto("/galeria");

  const lienzo = page.getByTestId("lienzo");
  const claro = await lienzo.evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByTestId("cambiar-tema").click();
  await expect(page.getByTestId("cambiar-tema")).toHaveAttribute("aria-pressed", "true");

  await expect
    .poll(async () => lienzo.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(claro);
});

test.describe("con el sistema en oscuro", () => {
  test.use({ colorScheme: "dark" });

  /**
   * La de arriba corre con el sistema en claro, y ahí el interruptor funcionaba
   * aunque escribiera el `data-theme` en el lienzo en vez de en el `<html>`.
   * Esta es la que lo pilla: con el sistema ya en oscuro, quitar el atributo
   * del lienzo no devuelve nada a claro, porque el color se HEREDA del `<html>`.
   */
  test("el interruptor devuelve el lienzo a claro", async ({ page }) => {
    await page.goto("/galeria");
    // El mismo cuidado que en `tema.spec.ts`: en desarrollo React remonta una
    // vez y borra el atributo del script, y `TemaDelSistema` lo repone después.
    await expect(page.locator("html")).toHaveAttribute("data-tema-listo", "1");

    const lienzo = page.getByTestId("lienzo");
    const boton = page.getByTestId("cambiar-tema");

    // La galería abre en oscuro porque el sistema lo está, y el botón lo sabe:
    // lee el `<html>` en lugar de arrancar su propia cuenta en `false`.
    await expect(boton).toHaveAttribute("aria-pressed", "true");
    await expect(lienzo).toHaveCSS("background-color", LIENZO_OSCURO);

    await boton.click();

    await expect(boton).toHaveAttribute("aria-pressed", "false");
    await expect(lienzo).toHaveCSS("background-color", LIENZO_CLARO);
  });
});
