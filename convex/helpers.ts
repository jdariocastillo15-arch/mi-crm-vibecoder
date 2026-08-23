import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
    throw new Error("Solo la Dueña puede hacer esto");
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
