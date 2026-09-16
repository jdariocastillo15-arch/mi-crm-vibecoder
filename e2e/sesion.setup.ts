import { continuarConCorreo, expect, test as preparar } from "./prueba";
import { SESION_COMERCIAL, SESION_PROPIETARIA } from "./sesion";

/**
 * Entra UNA vez por ejecución con cada cuenta de prueba, por la pantalla de
 * acceso de verdad, y guarda su sesión para el resto de pruebas — implementa
 * parte de JES-100.
 *
 * Las dos cuentas existen solo en desarrollo y ya tienen su contraseña elegida.
 * Una con la contraseña pendiente no serviría, y además no se puede usar aquí:
 * escribir su correo en el primer paso le manda un código real por Resend
 * (`convex/acceso.ts`).
 */
const CUENTAS = [
  {
    rol: "propietaria",
    variableEmail: "E2E_PROPIETARIA_EMAIL",
    variablePassword: "E2E_PROPIETARIA_PASSWORD",
    sesion: SESION_PROPIETARIA,
  },
  {
    rol: "comercial",
    variableEmail: "E2E_COMERCIAL_EMAIL",
    variablePassword: "E2E_COMERCIAL_PASSWORD",
    sesion: SESION_COMERCIAL,
  },
];

for (const cuenta of CUENTAS) {
  preparar(`entra como ${cuenta.rol}`, async ({ page }) => {
    const email = process.env[cuenta.variableEmail];
    const password = process.env[cuenta.variablePassword];
    if (!email || !password) {
      throw new Error(
        `Faltan ${cuenta.variableEmail} y ${cuenta.variablePassword} en .env.local. Ver .env.example.`,
      );
    }

    // La guarda de `playwright.config.ts` comprueba el fichero de entorno, pero
    // no un servidor que ya estuviera corriendo y se reutilice. Este corte
    // cubre ese caso desde el navegador: la conexión con Convex solo llega al
    // servidor si es la de desarrollo. Cualquier otra se cierra antes de que
    // salga un solo mensaje, y el primero sería el paso del correo, que en una
    // ficha pendiente manda un código real.
    const hostEsperado = new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").hostname;
    let conexiones = 0;
    let hostAjeno: string | null = null;
    await page.routeWebSocket(/\.convex\.cloud\//, (ws) => {
      conexiones += 1;
      const host = new URL(ws.url()).hostname;
      if (host === hostEsperado) {
        ws.connectToServer();
      } else {
        hostAjeno = host;
        ws.close();
      }
    });

    await page.goto("/login");
    // Convex no abre la conexión hasta la primera llamada, que es la de este paso.
    await continuarConCorreo(page, email, async (p) => {
      expect(
        hostAjeno,
        "La aplicación habla con un despliegue de Convex que no es el de desarrollo",
      ).toBeNull();
      await expect(p.getByRole("heading", { name: "Tu contraseña" })).toBeVisible({
        timeout: 10_000,
      });
    });
    // Y que el corte ha estado de verdad en medio. Si Convex cambiara de
    // dominio, el patrón dejaría de casar y la guarda no vería pasar nada.
    expect(conexiones, "La guarda no ha visto la conexión con Convex").toBeGreaterThan(0);

    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await page.waitForURL("**/hoy");
    await expect(
      page.getByRole("heading", { level: 1, name: "Hoy", exact: true }),
    ).toBeVisible();

    await page.context().storageState({ path: cuenta.sesion });
  });
}
