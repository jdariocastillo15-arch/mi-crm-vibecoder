import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { rolUsuario } from "./schema";
import { requireUser, requirePropietaria } from "./helpers";

/** Usuarios y equipo — implementa JES-47, JES-48, JES-49, JES-68, JES-69 y JES-70. */

/** El usuario de la sesión. Devuelve null si no hay sesión, sin lanzar. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await requireUser(ctx);
    } catch {
      return null;
    }
  },
});

/**
 * El equipo. Cualquiera puede leerlo — hace falta para elegir responsable de un
 * seguimiento y para mostrar quién registró cada cosa. Lo que está restringido
 * a la Dueña es *modificarlo*.
 */
export const listEquipo = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name ?? "",
      email: u.email ?? "",
      rol: u.rol ?? "comercial",
    }));
  },
});

/** "Editar mis datos" — cada quien cambia lo suyo, sin importar el rol. */
export const actualizarPerfil = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    const user = await requireUser(ctx);

    const nombre = name.trim();
    if (nombre.length === 0) throw new Error("Indica un nombre");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("Introduce un email válido");
    }

    await ctx.db.patch(user._id, { name: nombre, email: email.trim() });
  },
});

/** Editar a otra persona del equipo. Solo la Dueña. */
export const actualizarUsuario = mutation({
  args: {
    usuarioId: v.id("users"),
    name: v.string(),
    email: v.string(),
    rol: rolUsuario,
  },
  handler: async (ctx, { usuarioId, name, email, rol }) => {
    await requirePropietaria(ctx);

    const nombre = name.trim();
    if (nombre.length === 0) throw new Error("Indica un nombre");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("Introduce un email válido");
    }

    // Quitarle el rol de Dueña a la última que queda deja al equipo sin administradora.
    const objetivo = await ctx.db.get(usuarioId);
    if (objetivo === null) throw new Error("Ese usuario ya no existe");
    if (objetivo.rol === "propietaria" && rol !== "propietaria") {
      const duenas = (await ctx.db.query("users").collect()).filter(
        (u) => u.rol === "propietaria",
      );
      if (duenas.length <= 1) {
        throw new Error("El equipo no puede quedarse sin ninguna Dueña");
      }
    }

    await ctx.db.patch(usuarioId, { name: nombre, email: email.trim(), rol });
  },
});

/**
 * Eliminar a alguien del equipo, con las dos protecciones del diseño.
 * Se comprueban aquí, en el servidor: ocultar el botón en la interfaz es
 * comodidad, no seguridad.
 */
export const eliminarUsuario = mutation({
  args: { usuarioId: v.id("users") },
  handler: async (ctx, { usuarioId }) => {
    const actual = await requirePropietaria(ctx);

    // Protección 1: nadie puede borrarse a sí mismo.
    if (actual._id === usuarioId) {
      throw new Error("No puedes eliminarte a ti misma");
    }

    // Protección 2: el equipo nunca puede quedarse sin Dueña.
    const objetivo = await ctx.db.get(usuarioId);
    if (objetivo === null) throw new Error("Ese usuario ya no existe");
    if (objetivo.rol === "propietaria") {
      const duenas = (await ctx.db.query("users").collect()).filter(
        (u) => u.rol === "propietaria",
      );
      if (duenas.length <= 1) {
        throw new Error("El equipo no puede quedarse sin ninguna Dueña");
      }
    }

    // El historial que registró esta persona NO se borra con ella: sus
    // interacciones, ventas y seguimientos siguen existiendo. Queda pendiente
    // decidir qué pasa con sus seguimientos pendientes — ver JES-70.
    await ctx.db.delete(usuarioId);
  },
});

/**
 * PENDIENTE (JES-69): dar de alta a alguien del equipo desde la pantalla de
 * Equipo. Convex Auth necesita `createAccount` para crear la cuenta de otra
 * persona, y antes hay que decidir cómo entra por primera vez: invitación por
 * email o contraseña provisional. Mientras tanto, cada usuario se da de alta
 * desde la propia pantalla de login.
 */
