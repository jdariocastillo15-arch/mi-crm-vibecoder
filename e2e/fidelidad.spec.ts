import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./prueba";

/**
 * Fidelidad al diseño, la parte que tiene respuesta correcta — JES-74.
 *
 * Aquí solo vive lo COMPROBABLE. «¿Quedó como se diseñó?» es un juicio visual
 * que hace el dueño con el prototipo al lado, y no hay instantáneas versionadas
 * a propósito: meterían imágenes binarias en el repositorio y son una fuente
 * conocida de fallos intermitentes por el renderizado de fuentes.
 *
 * Lo que sí se puede afirmar sin opinar: que no haya emoji, que las cifras vayan
 * en mono tabular, que los importes de fila queden a la derecha, y que las
 * pantallas resuelvan los tokens oscuros.
 */

const LIENZO_OSCURO = "rgb(14, 15, 17)"; // --color-bg en oscuro, #0e0f11

/** El título de la barra superior, que es el único <h1> de cada pantalla. */
function titulo(page: Page, texto: string) {
  return page.getByRole("heading", { level: 1, name: texto, exact: true });
}

// ---------------------------------------------------------------------------
// Sin emoji
// ---------------------------------------------------------------------------

/**
 * Los rangos de emoji, más el selector de variación que los pinta a color.
 *
 * Hoy el barrido sale limpio, así que esta prueba nace en verde y su trabajo es
 * que siga así. Lo pide el diseño tres veces:
 * `DESING/design_handoff_crm_pwa/README.md` líneas 217, 218 y 224.
 */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const CARPETAS = ["app", "components", "lib"];
const EXTENSIONES = [".ts", ".tsx", ".css"];

function ficherosDe(carpeta: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(carpeta)) {
    const ruta = join(carpeta, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...ficherosDe(ruta));
    else if (EXTENSIONES.some((e) => ruta.endsWith(e))) salida.push(ruta);
  }
  return salida;
}

/**
 * Se barre el CÓDIGO FUENTE, no el texto renderizado, y es deliberado.
 *
 * Renderizando, un cliente de prueba llamado «Acme 🚀» haría fallar la prueba
 * sin que la interfaz tenga culpa de nada: lo que escriben los usuarios en sus
 * fichas y sus notas no es cosa del diseño. El fuente solo contiene lo que
 * escribe la aplicación, que es exactamente lo que el criterio exige limpio.
 */
test("no hay ni un emoji en los textos de la interfaz", () => {
  const culpables: string[] = [];

  for (const carpeta of CARPETAS) {
    for (const fichero of ficherosDe(join(process.cwd(), carpeta))) {
      const lineas = readFileSync(fichero, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (!EMOJI.test(linea)) return;
        const relativa = fichero.slice(process.cwd().length + 1);
        culpables.push(`${relativa}:${i + 1}  ${linea.trim().slice(0, 80)}`);
      });
    }
  }

  expect(culpables, "El diseño prohíbe los emoji en la interfaz").toEqual([]);
});

// ---------------------------------------------------------------------------
// Las cifras
// ---------------------------------------------------------------------------

/**
 * El valor de una métrica de cabecera: el `<span>` que va detrás de su rótulo.
 *
 * Se busca por el rótulo y no por la clase. Una prueba que mire cadenas de
 * clases pasa en verde con el estilo roto, que es justo lo que no queremos.
 */
function metrica(page: Page, rotulo: string): Locator {
  return page
    .getByText(rotulo, { exact: true })
    .locator("xpath=following-sibling::span[1]");
}

/**
 * El importe de una fila de Ventas.
 *
 * La fila son tres hijos —el círculo del icono, el bloque del concepto y el
 * bloque de la derecha—, y el importe es el primer `<span>` del último. Es
 * estructural, sí; no hay `data-testid` en esa lista y añadir uno solo para
 * esto sería tocar producción por una prueba.
 */
function importeDeFila(fila: Locator): Locator {
  return fila.locator("> div").last().locator("span").first();
}

test("las cifras de Ventas van en mono tabular", async ({ page }) => {
  await page.goto("/ventas");
  await expect(titulo(page, "Ventas")).toBeVisible();

  // DOS COSAS SOSTIENEN ESTO, y hacen falta las dos para que la prueba tenga
  // dientes. `tabular-nums` llega por partida doble —la clase de utilidad del
  // componente y la regla global de `globals.css:262`, que se la pone a todo lo
  // que lleve `font-mono`—, así que quitar una de las dos no cambia el valor
  // calculado: comprobado. Lo que sí rompe de verdad es que una cifra se pinte
  // SIN la mono, y eso lo caza el afirmado de la familia.
  for (const rotulo of ["En marcha", "Ganado"]) {
    const valor = metrica(page, rotulo);
    await expect(valor, rotulo).toHaveCSS("font-family", /JetBrains Mono/);
    await expect(valor, rotulo).toHaveCSS("font-variant-numeric", "tabular-nums");
  }

  const fila = page.locator('a[href^="/clientes/"]').first();
  await expect(fila).toBeVisible();
  const importe = importeDeFila(fila);
  await expect(importe).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(importe).toHaveCSS("font-family", /JetBrains Mono/);
});

/**
 * «A la derecha», medido por posición y no por `text-align`.
 *
 * El importe queda a la derecha por el `items-end` del flex que lo envuelve, así
 * que su `text-align` es el de siempre: exigirlo haría fallar la prueba sobre
 * código correcto. Lo pilló la auditoría antes de que esto se escribiera.
 *
 * Y se compara contra el borde ÚTIL de la fila, descontando su relleno: el
 * importe está bien colocado sin tocar el borde exterior.
 *
 * Las métricas de cabecera NO entran aquí: van a la izquierda, igual que en el
 * prototipo (`CRM Shell.dc.html`, la tarjeta de «En marcha»). Moverlas para que
 * una prueba se ponga verde sería romper la fidelidad para medirla.
 */
test("los importes de Ventas quedan pegados al borde derecho de su fila", async ({
  page,
}) => {
  await page.goto("/ventas");
  await expect(titulo(page, "Ventas")).toBeVisible();

  const fila = page.locator('a[href^="/clientes/"]').first();
  await expect(fila).toBeVisible();

  // EL MECANISMO, primero. Medir solo la posición no basta: el bloque de la
  // derecha es `shrink-0` y hoy el importe es lo más ancho que contiene, así
  // que sale pegado al borde incluso con la alineación al revés —comprobado,
  // cambiando `items-end` por `items-start` la medición seguía pasando—. Con
  // otros datos, una fecha más larga que el importe lo dejaría descolgado.
  const bloqueDerecho = fila.locator("> div").last();
  await expect(bloqueDerecho).toHaveCSS("align-items", "flex-end");

  const cajaFila = await fila.boundingBox();
  const cajaImporte = await importeDeFila(fila).boundingBox();
  if (!cajaFila || !cajaImporte) throw new Error("La fila o su importe no tienen caja");

  const relleno = await fila.evaluate((el) =>
    parseFloat(getComputedStyle(el).paddingRight),
  );

  const holgura =
    cajaFila.x + cajaFila.width - relleno - (cajaImporte.x + cajaImporte.width);

  // Un píxel de margen por el redondeo a subpíxeles.
  expect(Math.abs(holgura), `holgura de ${holgura}px hasta el borde útil`).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------------------
// Las pantallas en oscuro
// ---------------------------------------------------------------------------

/**
 * Las pantallas son SIETE, no las ocho que dice el criterio: `/login`, `/hoy`,
 * `/clientes`, `/clientes/[id]`, `/ventas`, `/equipo` y `/cuenta`. La raíz
 * redirige y los formularios son overlays, no pantallas. El «ocho» es un
 * recuento viejo de cuando se redactó la issue.
 */
const CON_SESION = [
  { ruta: "/hoy", h1: "Hoy" },
  { ruta: "/clientes", h1: "Clientes" },
  { ruta: "/ventas", h1: "Ventas" },
  { ruta: "/equipo", h1: "Equipo" },
  { ruta: "/cuenta", h1: "Mi cuenta" },
] as const;

test.describe("con el sistema en oscuro", () => {
  test.use({ colorScheme: "dark" });

  /**
   * CADA RUTA CONFIRMA PRIMERO QUE CARGÓ. El color del `body` es el mismo en
   * todas, así que sin el `<h1>` delante esta prueba pasaría en verde aunque
   * las cinco rutas hubieran acabado en la misma pantalla —o en ninguna—. Lo
   * apuntó la auditoría.
   */
  test("las pantallas con sesión resuelven los tokens oscuros", async ({ page }) => {
    for (const { ruta, h1 } of CON_SESION) {
      await page.goto(ruta);
      await expect(titulo(page, h1), ruta).toBeVisible();
      await expect(page.locator("html"), ruta).toHaveAttribute("data-tema-listo", "1");
      await expect(page.locator("body"), ruta).toHaveCSS(
        "background-color",
        LIENZO_OSCURO,
      );
    }
  });

  test("la ficha de cliente resuelve los tokens oscuros", async ({ page }) => {
    await page.goto("/clientes");
    const fila = page.locator('a[href^="/clientes/"]').first();
    await expect(fila).toBeVisible();
    const nombre = await fila.locator(":scope > div > span").first().innerText();

    await fila.click();
    await expect(page).toHaveURL(/\/clientes\/[^/]+$/);
    await expect(titulo(page, nombre)).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", LIENZO_OSCURO);
  });
});

test.describe("el acceso en oscuro", () => {
  // Sin sesión: con ella, `/login` manda a `/hoy` y no habría nada que medir.
  test.use({ colorScheme: "dark", storageState: { cookies: [], origins: [] } });

  test("la pantalla de acceso resuelve los tokens oscuros", async ({ page }) => {
    await page.goto("/login");
    await expect(titulo(page, "Inicia sesión")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-tema-listo", "1");
    await expect(page.locator("body")).toHaveCSS("background-color", LIENZO_OSCURO);
  });
});
