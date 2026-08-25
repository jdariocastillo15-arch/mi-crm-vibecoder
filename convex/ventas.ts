import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { estadoVenta } from "./schema";
import { requireUser, assertClienteExiste, hoy } from "./helpers";

/** Ventas y oportunidades — implementa JES-65, JES-66 y JES-67. */

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("ventas").collect();
  },
});

/**
 * Las ventas de un cliente, con el nombre de quien las registró.
 * Mismo cruce y mismo motivo que en `interacciones.listByCliente`.
 */
export const listByCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUser(ctx);

    const ventas = await ctx.db
      .query("ventas")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();

    return await Promise.all(
      ventas.map(async (venta) => {
        // Puede faltar de verdad: borrar a alguien del equipo deja vivas sus
        // ventas (ver `users.eliminarUsuario` y JES-70).
        const autor = await ctx.db.get(venta.autorId);
        return { ...venta, autorNombre: autor?.name ?? null };
      }),
    );
  },
});

/**
 * Las dos cifras de cabecera de la pantalla de Ventas.
 * Se calculan, no se guardan. Las perdidas no suman en ninguna.
 */
export const metricas = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const ventas = await ctx.db.query("ventas").collect();

    const sumaDe = (estado: "abierta" | "ganada") =>
      ventas
        .filter((venta) => venta.estado === estado)
        .reduce((total, venta) => total + venta.importe, 0);

    return {
      enMarcha: sumaDe("abierta"),
      ganado: sumaDe("ganada"),
      conteo: {
        todas: ventas.length,
        abierta: ventas.filter((v) => v.estado === "abierta").length,
        ganada: ventas.filter((v) => v.estado === "ganada").length,
        perdida: ventas.filter((v) => v.estado === "perdida").length,
      },
    };
  },
});

export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    concepto: v.string(),
    importe: v.number(),
    estado: estadoVenta,
    fecha: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertClienteExiste(ctx, args.clienteId);

    const concepto = args.concepto.trim();
    if (concepto.length === 0) throw new Error("Indica qué se vende");
    if (!Number.isFinite(args.importe) || args.importe <= 0) {
      throw new Error("Indica un importe válido");
    }

    // Ojo: registrar una venta NO toca la fecha de último contacto.
    // Una venta no es un contacto (regla del PRD).
    return await ctx.db.insert("ventas", {
      clienteId: args.clienteId,
      concepto,
      importe: Math.round(args.importe),
      estado: args.estado,
      fecha: args.fecha ?? hoy(),
      autorId: user._id,
    });
  },
});
