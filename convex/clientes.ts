import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { canalOrigen, estadoCliente } from "./schema";
import { requireUser, hoy, esEmailValido } from "./helpers";

/**
 * Clientes — implementa JES-50, JES-52 y JES-54.
 *
 * Nota sobre el buscador: la lista se devuelve entera y el filtrado en vivo
 * ocurre en el cliente. Es lo correcto a la escala de este producto (un negocio
 * pequeño, decenas o pocos cientos de clientes) y es lo que permite filtrar
 * según se escribe, sin ida y vuelta al servidor. Si algún día la lista crece
 * de verdad, aquí es donde entra un índice de búsqueda.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("clientes").order("desc").collect();
  },
});

export const get = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUser(ctx);
    return await ctx.db.get(clienteId);
  },
});

export const crear = mutation({
  args: {
    nombre: v.string(),
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    canal: v.optional(canalOrigen),
    nota: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const nombre = args.nombre.trim();
    const telefono = args.telefono?.trim() ?? "";
    const email = args.email?.trim() ?? "";

    // Las dos reglas del alta rápida (JES-52).
    if (nombre.length === 0) throw new Error("Añade un nombre");
    if (telefono.length === 0 && email.length === 0) {
      throw new Error("Indica al menos un teléfono o un email");
    }
    // "Al menos un email" no vale de nada si el email es "asdf".
    if (email.length > 0 && !esEmailValido(email)) {
      throw new Error("Email no válido");
    }

    const fecha = hoy();
    return await ctx.db.insert("clientes", {
      nombre,
      empresa: args.empresa?.trim() || undefined,
      telefono: telefono || undefined,
      email: email || undefined,
      canal: args.canal,
      nota: args.nota?.trim() || undefined,
      estado: "nuevo_lead", // Todo cliente nace como lead nuevo.
      fechaAlta: fecha,
      ultimoContacto: fecha,
    });
  },
});

export const actualizar = mutation({
  args: {
    clienteId: v.id("clientes"),
    nombre: v.string(),
    // Se aceptan vacíos: a diferencia del prototipo, aquí la empresa SÍ se puede borrar.
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    canal: v.optional(canalOrigen),
    nota: v.optional(v.string()),
    estado: estadoCliente,
  },
  handler: async (ctx, { clienteId, ...campos }) => {
    await requireUser(ctx);

    const nombre = campos.nombre.trim();
    if (nombre.length === 0) throw new Error("Añade un nombre");

    const email = campos.email?.trim() || "";
    // Solo se valida si el email CAMBIA. Si no, una ficha antigua con un email
    // inválido quedaría bloqueada para todo lo demás: cambiar un teléfono o el
    // estado fallaría por un dato que quien edita ni ha tocado.
    const anterior = await ctx.db.get(clienteId);
    const emailCambia = email !== (anterior?.email ?? "");
    if (emailCambia && email.length > 0 && !esEmailValido(email)) {
      throw new Error("Email no válido");
    }

    await ctx.db.patch(clienteId, {
      nombre,
      empresa: campos.empresa?.trim() || undefined,
      telefono: campos.telefono?.trim() || undefined,
      email: email || undefined,
      canal: campos.canal,
      nota: campos.nota?.trim() || undefined,
      estado: campos.estado,
    });
  },
});
