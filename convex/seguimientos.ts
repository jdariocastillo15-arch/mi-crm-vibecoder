import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, assertClienteExiste, hoy, diasDeRetraso } from "./helpers";

/**
 * Seguimientos — el corazón del CRM. Implementa JES-55, JES-58, JES-59 y JES-60.
 *
 * Sustituye a los recordatorios calculados por días sin contacto del PRD
 * original: aquí cada seguimiento dice QUÉ hay que hacer, CUÁNDO y QUIÉN.
 */

/** Los pendientes de todo el equipo, para la pantalla "Hoy". */
export const listPendientes = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db
      .query("seguimientos")
      .withIndex("by_hecho_vence", (q) => q.eq("hecho", false))
      .collect();
  },
});

export const listByCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUser(ctx);
    return await ctx.db
      .query("seguimientos")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();
  },
});

export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    accion: v.string(),
    vence: v.string(),
    /** Omitir para asignárselo a uno mismo, que es lo que hace "Nueva tarea". */
    responsableId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertClienteExiste(ctx, args.clienteId);

    const accion = args.accion.trim();
    if (accion.length === 0) throw new Error("Indica qué hay que hacer");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.vence)) throw new Error("Indica una fecha");

    return await ctx.db.insert("seguimientos", {
      clienteId: args.clienteId,
      accion,
      vence: args.vence,
      hecho: false,
      responsableId: args.responsableId ?? user._id,
    });
  },
});

/**
 * Marcar hecho y deshacer. La interfaz aplica el cambio al instante y luego
 * confirma con el servidor; si esto falla, la pantalla tiene que revertir.
 */
export const marcarHecho = mutation({
  args: { seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { seguimientoId }) => {
    await requireUser(ctx);
    await ctx.db.patch(seguimientoId, { hecho: true, fechaHecho: hoy() });
  },
});

export const deshacer = mutation({
  args: { seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { seguimientoId }) => {
    await requireUser(ctx);
    await ctx.db.patch(seguimientoId, { hecho: false, fechaHecho: undefined });
  },
});

/**
 * Clasificación en Atrasado / Para hoy / Próxima.
 *
 * Vive también en `lib/seguimientos.ts` para que la interfaz pueda agrupar sin
 * ida y vuelta al servidor. Las dos usan la misma regla: si cambias una,
 * cambia la otra.
 */
export function clasificar(vence: string, referencia: string = hoy()) {
  const dias = diasDeRetraso(vence, referencia);
  if (dias > 0) return "atrasado" as const;
  if (dias === 0) return "hoy" as const;
  return "proxima" as const;
}
