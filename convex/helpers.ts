import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/** Devuelve el usuario de la sesión, o lanza si no hay sesión. */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("No hay sesión iniciada");
  const user = await ctx.db.get(userId);
  if (user === null) throw new Error("El usuario de la sesión ya no existe");
  return user;
}

/**
 * Exige rol de Dueña. Es la comprobación de servidor que respalda a la interfaz:
 * ocultar un botón no es una regla de seguridad (JES-47, JES-70).
 */
export async function requirePropietaria(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  if (user.rol !== "propietaria") {
    throw new Error("Solo quien lleva el equipo puede hacer esto");
  }
  return user;
}

/**
 * El día de negocio es uno solo, y es este.
 *
 * Existe la misma constante en `lib/format.ts`: si cambias una, cambia la otra.
 * Antes esto era `toISOString()`, es decir UTC, mientras el navegador usaba el
 * reloj del dispositivo. Entre las 00:00 y las 02:00 en Madrid eso ponía a
 * cliente y servidor en días distintos: la misma tarea caía en secciones
 * distintas y `fechaHecho` se grababa con el día anterior.
 */
export const ZONA_NEGOCIO = "Europe/Madrid";

/** Fecha de hoy en YYYY-MM-DD, según el día de negocio. */
export function hoy(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

/**
 * ¿Existe esa fecha de verdad? El formato no basta: "2026-02-30" pasa cualquier
 * regex y luego `Date.parse` devuelve NaN, con lo que la clasificación la manda
 * a "próxima" y el subtítulo sale como "Vence el 30 undefined".
 *
 * Existe la misma función en `lib/format.ts`: si cambias una, cambia la otra.
 */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;

  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/**
 * Formato de email. Réplica de `lib/format.ts#esEmailValido`: si cambias una,
 * cambia la otra. Aquí es la que manda — la del cliente solo sirve para dar el
 * mensaje antes de llamar.
 */
export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Cuántos días lleva vencida una fecha respecto a hoy. Negativo = aún no vence. */
export function diasDeRetraso(fecha: string, referencia: string = hoy()): number {
  const a = Date.parse(`${referencia}T00:00:00Z`);
  const b = Date.parse(`${fecha}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export async function assertClienteExiste(
  ctx: QueryCtx | MutationCtx,
  clienteId: Id<"clientes">,
) {
  const cliente = await ctx.db.get(clienteId);
  if (cliente === null) throw new Error("Ese cliente no existe");
  return cliente;
}

// ---------------------------------------------------------------------------
// El email como credencial — JES-83.
//
// Desde que se puede entrar con Google, `users.email` dejó de ser un dato de
// contacto: es lo que decide si esa cuenta de Google abre la puerta. Por eso
// vive aquí, en un solo sitio, todo lo que lo lee y lo escribe. Cualquier
// camino nuevo que toque el email tiene que pasar por estas funciones.
// ---------------------------------------------------------------------------

/** Forma canónica de un email: sin espacios alrededor y en minúsculas. */
export function normalizaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * El usuario que tiene ese email, o null si no hay ninguno.
 *
 * **Falla cerrado**: si hubiera dos filas con el mismo email —aunque difieran
 * en mayúsculas— lanza en vez de elegir una. Con el email decidiendo accesos,
 * escoger "la primera que aparezca" sería enlazar a la identidad equivocada.
 *
 * Recorre la tabla entera en lugar de usar el índice `email`, porque el índice
 * distingue mayúsculas y Google devuelve el correo siempre en minúsculas. Es
 * asumible: `users` es el equipo, dos o tres filas, y `listEquipo` ya lo hace.
 */
export async function buscarUsuarioPorEmail(
  db: QueryCtx["db"] | MutationCtx["db"],
  email: string,
): Promise<Doc<"users"> | null> {
  const buscado = normalizaEmail(email);
  if (buscado.length === 0) return null;

  const equipo = await db.query("users").collect();
  const coincidencias = equipo.filter(
    (u) => normalizaEmail(u.email ?? "") === buscado,
  );

  if (coincidencias.length > 1) {
    throw new Error(
      `Hay ${coincidencias.length} usuarios con el email ${buscado}: no se puede saber quién es`,
    );
  }
  return coincidencias[0] ?? null;
}

/**
 * Asigna un email a alguien del equipo, con las tres invariantes en un sitio:
 * normalizado, único sin distinguir mayúsculas, y arrastrando la credencial.
 *
 * Lo tercero es lo que se olvida: Convex Auth guarda el email DOS VECES —en
 * `users.email` y como `providerAccountId` de la cuenta de contraseña—. Si solo
 * se cambia el primero, esa persona acaba con dos identidades: entra con el
 * correo viejo por contraseña y con el nuevo por Google. Por eso los mueve los
 * dos, y por eso lo usan todos los caminos que cambian un email.
 */
export async function asignarEmail(
  ctx: MutationCtx,
  usuarioId: Id<"users">,
  emailNuevo: string,
): Promise<{ email: string; cambiado: boolean; contrasenaMovida: boolean }> {
  const email = normalizaEmail(emailNuevo);
  if (!esEmailValido(email)) throw new Error("Introduce un email válido");

  const usuario = await ctx.db.get(usuarioId);
  if (usuario === null) throw new Error("Ese usuario ya no existe");

  const ocupado = await buscarUsuarioPorEmail(ctx.db, email);
  if (ocupado !== null && ocupado._id !== usuarioId) {
    throw new Error(`Ya hay otra persona en el equipo con ${email}`);
  }

  const cambiado = usuario.email !== email;
  if (cambiado) {
    await ctx.db.patch(usuarioId, { email });
  }

  // La credencial se mira SIEMPRE, aunque `users.email` ya estuviera bien.
  // Puede haberse quedado atrás por su cuenta: un alta antigua guardó el correo
  // tal y como se tecleó, o alguien tocó una de las dos tablas sin la otra.
  // Así esta función también sirve para sanear —basta ejecutarla con el correo
  // que la persona ya tiene— y es idempotente: repetirla no cambia nada.
  const cuentaPassword = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", usuarioId).eq("provider", "password"),
    )
    .unique();

  const contrasenaMovida =
    cuentaPassword !== null && cuentaPassword.providerAccountId !== email;
  if (cuentaPassword !== null && contrasenaMovida) {
    await ctx.db.patch(cuentaPassword._id, { providerAccountId: email });
  }

  return { email, cambiado, contrasenaMovida };
}
