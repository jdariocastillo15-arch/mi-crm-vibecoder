import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { canalInteraccion } from "./schema";
import { requireUser, assertClienteExiste, hoy } from "./helpers";

/** Interacciones — implementa JES-62 y JES-63. */

export const listByCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUser(ctx);
    return await ctx.db
      .query("interacciones")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();
  },
});

export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    canal: canalInteraccion,
    texto: v.string(),
    fecha: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const cliente = await assertClienteExiste(ctx, args.clienteId);

    const texto = args.texto.trim();
    if (texto.length === 0) throw new Error("Escribe qué pasó");

    const fecha = args.fecha ?? hoy();

    const id = await ctx.db.insert("interacciones", {
      clienteId: args.clienteId,
      canal: args.canal,
      texto,
      fecha,
      autorId: user._id,
    });

    // Regla del PRD: el último contacto solo avanza, nunca retrocede.
    // Anotar hoy una llamada de la semana pasada no debe hacer parecer que el
    // cliente está fresco.
    if (fecha > cliente.ultimoContacto) {
      await ctx.db.patch(args.clienteId, { ultimoContacto: fecha });
    }

    return id;
  },
});
