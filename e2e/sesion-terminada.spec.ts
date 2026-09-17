import type { BrowserContext, Page, Request, WebSocketRoute } from "@playwright/test";
import { continuarConCorreo, expect, test } from "./prueba";

/**
 * La sesión que termina con la aplicación abierta — implementa parte de JES-101.
 *
 * Cada prueba entra con su PROPIA sesión y la revoca con `auth:signOut` por la
 * API HTTP de Convex, con su propio JWT: se borra esa sesión y ninguna más. No
 * usan la sesión compartida de `sesion.setup.ts`, porque la tumbarían.
 *
 * Tras revocarla, el JWT sigue valiendo hasta una hora, así que el middleware y
 * `useConvexAuth()` siguen viendo al navegador autenticado. Ese es justo el caso
 * que hay que cubrir: solo el servidor sabe que la sesión ya no existe.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function entrar(page: Page) {
  await page.goto("/login");
  await continuarConCorreo(page, process.env.E2E_COMERCIAL_EMAIL ?? "", async (p) => {
    await expect(p.getByRole("heading", { name: "Tu contraseña" })).toBeVisible({
      timeout: 10_000,
    });
  });
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.E2E_COMERCIAL_PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoy");
}

/** Revoca en el servidor la sesión de este contexto, sin tocar el navegador. */
async function revocar(context: BrowserContext) {
  const jwt = (await context.cookies()).find((c) => c.name === "__convexAuthJWT")?.value;
  expect(jwt, "no hay JWT que revocar").toBeTruthy();
  const respuesta = await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ path: "auth:signOut", args: {}, format: "json" }),
  });
  expect((await respuesta.json()).status).toBe("success");
}

/** ¿Le queda al navegador algún token de sesión, en cookie o en almacenamiento? */
async function credencialesQueQuedan(page: Page, context: BrowserContext) {
  const cookies = (await context.cookies())
    .filter((c) => c.name.startsWith("__convexAuth") && c.value !== "")
    .map((c) => c.name);
  const almacen = await page.evaluate(() =>
    Object.keys(localStorage).filter(
      (k) => k.startsWith("__convexAuthJWT") || k.startsWith("__convexAuthRefreshToken"),
    ),
  );
  return [...cookies, ...almacen];
}

test("revocada con Mi cuenta abierta, sale sola al acceso y sin credenciales", async ({
  page,
  context,
}) => {
  await entrar(page);
  await page.goto("/cuenta");
  await expect(
    page.getByRole("main").getByText("Atiende y vende", { exact: true }),
  ).toBeVisible();

  await revocar(context);

  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Inicia sesión" }),
  ).toBeVisible();
  expect(await credencialesQueQuedan(page, context)).toEqual([]);
});

test("revocada con Clientes abierta, llega al acceso sin pantalla de error", async ({
  page,
  context,
}) => {
  await entrar(page);
  await page.goto("/clientes");
  await expect(page.locator('a[href^="/clientes/"]').first()).toBeVisible();

  await revocar(context);

  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Inicia sesión" }),
  ).toBeVisible();
  await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
});

test("abrir la app con una sesión ya revocada acaba en el acceso", async ({
  page,
  context,
  browser,
}) => {
  await entrar(page);
  const estado = await context.storageState();
  // Fuera de la app antes de revocar: esta pestaña no es la que se prueba.
  await page.goto("about:blank");
  await revocar(context);

  const otro = await browser.newContext({ storageState: estado });
  try {
    const pagina = await otro.newPage();
    const excepciones: string[] = [];
    pagina.on("pageerror", (e) => excepciones.push(e.message));

    await pagina.goto("/cuenta");
    await expect(pagina).toHaveURL(/\/login$/, { timeout: 20_000 });
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Inicia sesión" }),
    ).toBeVisible();
    expect(excepciones).toEqual([]);
  } finally {
    await otro.close();
  }
});

test("tras una renovación fallida, el acceso no se queda bajo otra URL", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\.convex\.cloud\//, (ws) => {
    ws.connectToServer();
    sockets.push(ws);
  });

  // Las llamadas a /api/auth que siguen en marcha. Hay que esperar a que no
  // quede ninguna antes de borrar las cookies: una renovación normal que
  // volviera después las pondría otra vez, y la prueba no probaría nada. Pasó
  // en una de las pasadas de diagnóstico.
  const esAuth = (r: Request) => r.url().endsWith("/api/auth") && r.method() === "POST";
  let enMarcha = 0;
  page.on("request", (r) => {
    if (esAuth(r)) enMarcha += 1;
  });
  const terminada = (r: Request) => {
    if (esAuth(r)) enMarcha -= 1;
  };
  page.on("requestfinished", terminada);
  page.on("requestfailed", terminada);

  await entrar(page);
  await page.goto("/cuenta");
  await expect(
    page.getByRole("main").getByText("Atiende y vende", { exact: true }),
  ).toBeVisible();

  // Sin la cookie de renovación, la próxima renovación del proveedor falla DE
  // VERDAD: el proxy de /api/auth devuelve la sesión vacía, el proveedor llama
  // a `invalidateCache` y esa acción de servidor trae el contenido de /login
  // sin cambiar la URL. Es la secuencia vista el 2026-09-16 en /cuenta.
  //
  // Lo único simulado es el disparador: el servidor de Convex rechaza el token,
  // como haría con uno caducado. A partir de ahí corre el código real del
  // cliente de Convex y del proveedor de acceso. `baseVersion` alto para que el
  // cliente no lo descarte como respuesta a un intento anterior.
  //
  // Se repite hasta que la renovación vuelva VACÍA. Si vuelve con tokens, no se
  // ha reproducido nada y hay que volver a intentarlo.
  await expect(async () => {
    await expect.poll(() => enMarcha).toBe(0);
    await context.clearCookies();
    const respuesta = page.waitForResponse((r) => esAuth(r.request()), {
      timeout: 5_000,
    });
    sockets.at(-1)?.send(
      JSON.stringify({
        type: "AuthError",
        error: "Token rechazado (prueba)",
        baseVersion: 1_000_000,
        authUpdateAttempted: true,
      }),
    );
    expect((await (await respuesta).json()).tokens).toBeNull();
  }).toPass({ timeout: 40_000 });

  await expect(
    page.getByRole("heading", { level: 1, name: "Inicia sesión" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
});
