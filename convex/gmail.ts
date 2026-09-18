import { SignJWT, importPKCS8 } from "jose";

/**
 * Hablar con Gmail, y solo para leer — implementa parte de JES-103.
 *
 * Este fichero no sabe nada del CRM: pide un token y hace peticiones. Quién es
 * cliente y qué se guarda se decide en `lib/correo.ts` y `correos.ts`.
 *
 * El buzón se lee con una **cuenta de servicio con delegación de dominio**, no
 * con OAuth de cada usuario. El motivo es que `gmail.readonly` es un permiso
 * "restringido" de Google: pedírselo a cuentas de fuera obliga a verificar la
 * aplicación y a una auditoría de seguridad anual de un tercero. Dentro del
 * propio dominio no, porque quien administra el dominio se autoriza a sí mismo.
 * La contrapartida está asumida: solo se pueden leer buzones @vibe-crm-pro.net.
 */

/** Lo único que se le pide a Google. De solo lectura, y nada más. */
const AMBITO = "https://www.googleapis.com/auth/gmail.readonly";

/** Donde el JWT firmado se cambia por un token de acceso. */
const OAUTH = "https://oauth2.googleapis.com/token";

/** La API, siempre sobre el buzón suplantado. */
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type Credenciales = {
  /** La cuenta de servicio que firma. */
  cuenta: string;
  /** Su clave privada, en PEM y ya descodificada. */
  clave: string;
  /** El buzón que se suplanta. */
  buzon: string;
};

/**
 * Las tres variables del despliegue, o `null` si falta alguna.
 *
 * Devuelve `null` en vez de lanzar, igual que `equipo.ts:75-78` con
 * `AUTH_RESEND_KEY`: un despliegue sin configurar no es un error, es uno que
 * todavía no lee correo. El cron lo comprueba y se va sin hacer nada.
 *
 * La clave viaja en base64 a propósito. Pegada en crudo en una variable de
 * entorno, el PEM pierde los saltos de línea e `importPKCS8` falla con un error
 * que no menciona los saltos de línea por ningún lado.
 */
export function credenciales(): Credenciales | null {
  const cuenta = process.env.GMAIL_SA_EMAIL;
  const claveB64 = process.env.GMAIL_SA_CLAVE_B64;
  const buzon = process.env.GMAIL_BUZON;

  if (!cuenta || !claveB64 || !buzon) return null;

  return { cuenta, clave: atob(claveB64), buzon };
}

/**
 * Un token de acceso al buzón, válido una hora.
 *
 * Es el baile de siempre de una cuenta de servicio con delegación: se firma un
 * JWT que dice «yo, esta cuenta de servicio, actúo como este buzón» —eso es el
 * `sub`— y Google lo cambia por un token. La delegación se concede en el panel
 * de administración de Workspace y solo para `gmail.readonly`: aunque aquí se
 * pidiera más, Google no lo daría.
 *
 * Se firma con RS256 dentro del runtime normal de Convex, sin acción en modo
 * Node. No es un experimento: es lo mismo que hace Convex Auth en cada inicio
 * de sesión de esta aplicación, con esta misma librería
 * (`@convex-dev/auth/dist/server/implementation/tokens.js`).
 */
export async function tokenDeAcceso(cred: Credenciales): Promise<string> {
  const clave = await importPKCS8(cred.clave, "RS256");
  const ahora = Math.floor(Date.now() / 1000);

  const aserto = await new SignJWT({ scope: AMBITO })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(cred.cuenta)
    .setSubject(cred.buzon)
    .setAudience(OAUTH)
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + 3600)
    .sign(clave);

  const respuesta = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: aserto,
    }),
  });

  if (!respuesta.ok) {
    // Del fallo se queda el `error_description`, que es lo que distingue «falta
    // la delegación» de «la clave no vale» y no lleva nada secreto dentro. El
    // cuerpo entero no se registra, y el asserto firmado tampoco.
    const detalle = (await respuesta.json().catch(() => null)) as {
      error?: string;
      error_description?: string;
    } | null;

    throw new Error(
      `Google rechazó la credencial (${respuesta.status}): ` +
        `${detalle?.error_description ?? detalle?.error ?? "sin detalle"}`,
    );
  }

  const datos = (await respuesta.json()) as { access_token?: string };
  if (!datos.access_token) {
    throw new Error("Google aceptó la credencial pero no devolvió token");
  }

  return datos.access_token;
}

/**
 * Un GET a la API de Gmail sobre el buzón suplantado.
 *
 * Ojo con `users/me`: no es «el dueño de la cuenta de servicio», que no tiene
 * buzón, sino quien diga el `sub` del token. O sea, `GMAIL_BUZON`.
 *
 * Del error se guarda el código y la ruta sin su consulta: en la consulta van
 * las fechas de la ventana, que no aportan nada al diagnóstico y ensucian el
 * registro.
 */
export async function pedirAGmail<T>(ruta: string, token: string): Promise<T> {
  const respuesta = await fetch(`${API}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!respuesta.ok) {
    throw new Error(
      `Gmail respondió ${respuesta.status} a ${ruta.split("?")[0]}`,
    );
  }

  return (await respuesta.json()) as T;
}
