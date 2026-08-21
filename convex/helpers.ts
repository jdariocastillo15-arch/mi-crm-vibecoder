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

/** Fecha de hoy en formato YYYY-MM-DD. */
export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
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
