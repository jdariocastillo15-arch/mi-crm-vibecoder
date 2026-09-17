import { expect, test as base, type Page } from "@playwright/test";

/**
 * El `test` de este proyecto — implementa parte de JES-100.
 *
 * Añade dos cosas a cada página, las dos para que la prueba vea la aplicación
 * como la vería alguien en producción:
 *
 * · ESCONDE EL INDICADOR DE NEXT. La burbuja de desarrollo va en la esquina
 *   inferior izquierda y en móvil tapa la pestaña «Hoy». Playwright se niega a
 *   pulsar un enlace tapado, y hace bien. En producción esa burbuja no existe.
 *
 * · FALLA SI LA PÁGINA LANZA UNA EXCEPCIÓN SIN RECOGER. Una pantalla puede
 *   pintarse bien y haber roto algo por debajo; así no pasa desapercibido.
 */
export const test = base.extend({
  // `usar` y no `use`: con el nombre de siempre, la regla de hooks de React lo
  // toma por su hook `use` y marca un error que no lo es.
  page: async ({ page }, usar) => {
    const excepciones: string[] = [];
    page.on("pageerror", (error) => excepciones.push(error.message));

    await page.addInitScript(() => {
      addEventListener("DOMContentLoaded", () => {
        const estilo = document.createElement("style");
        estilo.textContent =
          "nextjs-portal, [data-nextjs-dev-overlay] { display: none !important; }";
        document.head.append(estilo);
      });
    });

    await usar(page);

    expect(excepciones, "La página lanzó excepciones sin recoger").toEqual([]);
  },
});

export { expect };

/**
 * Escribe el correo del primer paso del acceso, pulsa «Continuar» y espera a
 * `llegada`, que es lo que tiene que aparecer si la pantalla lo ha recibido.
 *
 * REINTENTA, y no por capricho. La pantalla llega pintada del servidor y React
 * la hidrata un momento después, y lo que se escribe antes se pierde: el campo
 * es controlado y React le impone su estado, que empieza vacío.
 *
 * Medido, no supuesto. Escribiendo antes de la hidratación, el campo estaba
 * vacío tres segundos después en seis intentos de seis; escribiendo después,
 * en ninguno. Y `page.goto` no garantiza llegar hidratado: en una de las
 * primeras ejecuciones se escribió el correo y «Continuar» lo recibió vacío.
 *
 * No hay una señal pública de «ya está hidratado», así que se repite el paso
 * entero hasta que la pantalla responde a lo escrito.
 */
export async function continuarConCorreo(
  page: Page,
  correo: string,
  llegada: (page: Page) => Promise<void>,
) {
  await expect(async () => {
    await page.getByLabel("Email", { exact: true }).fill(correo);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await llegada(page);
  }).toPass({ timeout: 30_000 });
}
