import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { canalInteraccion } from "./schema";
import { requireUser, assertClienteExiste, hoy } from "./helpers";

/** Interacciones — implementa JES-62 y JES-63. */

/**
 * Las interacciones de un cliente, con el nombre de quien las anotó.
 *
 * El cruce se hace aquí y no en la pantalla por el mismo motivo que en
 * `seguimientos.listByCliente`: el historial (JES-64) escribe "Registrado por
 * X" y no debe traerse el equipo entero para escribir una palabra.
 */
export const listByCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUser(ctx);

    const interacciones = await ctx.db
      .query("interacciones")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();

    return await Promise.all(
      interacciones.map(async (interaccion) => {
        // Puede faltar de verdad: borrar a alguien del equipo deja vivo lo que
        // anotó (ver `users.eliminarUsuario` y JES-70).
        const autor = await ctx.db.get(interaccion.autorId);
        return { ...interaccion, autorNombre: autor?.name ?? null };
      }),
    );
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
