import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { SESION_PROPIETARIA } from "./e2e/sesion";

/**
 * Pruebas de extremo a extremo — implementa JES-100.
 *
 * Las variables se cargan con el mismo cargador que usa `next dev`, mismos
 * ficheros y mismo orden. Así la guarda de abajo mira la URL con la que va a
 * hablar la aplicación, y no una copia que pudiera discrepar.
 */
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

exigirDesarrollo();

const URL_BASE = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // `next dev` compila cada ruta la primera vez que se pide, y eso se come los
  // cinco segundos que da Playwright por defecto.
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: URL_BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "sesion", testMatch: /sesion\.setup\.ts/ },
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], storageState: SESION_PROPIETARIA },
      dependencies: ["sesion"],
    },
    {
      name: "movil",
      use: { ...devices["Pixel 7"], storageState: SESION_PROPIETARIA },
      dependencies: ["sesion"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${URL_BASE}/login`,
    // Si ya tienes `npm run dev` abierto, se usa ese en vez de arrancar otro.
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

/**
 * NUNCA CONTRA PRODUCCIÓN.
 *
 * Las pruebas abren sesiones, y cuando cubran altas escribirán datos. Por eso
 * no arrancan si la aplicación no va a hablar con el despliegue de desarrollo.
 *
 * Es una lista blanca y no una negra: aquí no se escribe el nombre de
 * producción, se exige que la URL sea la del despliegue que el CLI de Convex
 * tiene apuntado como `dev:`. Un despliegue desconocido o una URL copiada mal
 * se paran igual.
 */
function exigirDesarrollo() {
  const despliegue = process.env.CONVEX_DEPLOYMENT ?? "";
  const nombre = despliegue.startsWith("dev:") ? despliegue.slice(4) : "";

  let host = "";
  try {
    host = new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").hostname;
  } catch {
    // Sin URL, o mal formada: se queda vacío y la comprobación de abajo para.
  }

  if (nombre === "" || host !== `${nombre}.convex.cloud`) {
    throw new Error(
      "Las pruebas solo corren contra el despliegue de DESARROLLO de Convex. " +
        "Revisa CONVEX_DEPLOYMENT y NEXT_PUBLIC_CONVEX_URL en .env.local.",
    );
  }
}
