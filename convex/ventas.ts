import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { estadoVenta } from "./schema";
import { requireUser, assertClienteExiste, hoy } from "./helpers";

/** Ventas y oportunidades — implementa JES-65, JES-66 y JES-67. */

/**
 * Todas las ventas, con el nombre de su cliente — la pantalla "Ventas".
 *
 * Devuelve la tabla entera y sin resumir, a propósito: de aquí salen a la vez
 * el listado, los cuatro contadores del filtro y las dos cifras de cabecera
 * (`lib/ventas.ts#resumenVentas`). Sumar dos números de un array que ya está
 * en memoria es gratis, y sobre todo garantiza que las cifras y las filas no
 * puedan discrepar — que es literalmente uno de los criterios de JES-66.
 *
 * Aquí vivía además una consulta `metricas` que calculaba esas mismas sumas en
 * el servidor. Se ha quitado: no llegó a tener consumidores, releía la tabla
 * entera para responder lo que ya está aquí, y dejaba dos definiciones de "En
 * marcha" en sitios distintos. Está en el historial de git.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    const ventas = await ctx.db.query("ventas").collect();

    return await Promise.all(
      ventas.map(async (venta) => {
        const cliente = await ctx.db.get(venta.clienteId);

        // Hoy no puede pasar —`clientes` no tiene borrado—, pero si pasara, la
        // fila NO se descarta: es dinero, y hacerlo desaparecer del listado se
        // lo llevaría también de las sumas. Se avisa y se pinta sin cliente;
        // la pantalla enseña un guion y no la enlaza a ninguna parte.
        //
        // Es el trato contrario al de `seguimientos.listPendientes`, que sí
        // descarta: un seguimiento sin cliente no es accionable, una venta sí
        // cuenta.
        if (cliente === null) {
          console.warn(
            `La venta ${venta._id} apunta a un cliente que no existe; se pinta sin nombre.`,
          );
        }

        return { ...venta, clienteNombre: cliente?.nombre ?? null };
      }),
    );
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
