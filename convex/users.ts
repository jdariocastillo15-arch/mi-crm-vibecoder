import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { rolUsuario } from "./schema";
import {
  requireUser,
  requirePropietaria,
  esEmailValido,
  normalizaEmail,
  buscarUsuarioPorEmail,
  asignarEmail,
} from "./helpers";

/**
 * Usuarios y equipo — implementa JES-47, JES-48, JES-49, JES-68, JES-69, JES-70
 * y JES-83.
 *
 * Desde JES-83 el email no es un dato de contacto: es lo que decide si una
 * cuenta de Google abre la puerta. Todo lo que lo escriba pasa por
 * `helpers.ts#asignarEmail`, que normaliza, exige unicidad y arrastra la
 * credencial de contraseña.
 */

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

/**
 * "Editar mis datos" — cada quien cambia su nombre, sin importar el rol.
 *
 * El email NO se cambia aquí, y no es un olvido: es la credencial con la que
 * Google abre la puerta (JES-83). Si cada persona pudiera reescribirlo, podría
 * apuntarlo a una cuenta de Google que controle y saltarse la provisión de la
 * Dueña. Lo asigna ella, con `actualizarUsuario`. Cuando JES-49 monte "Mi
 * cuenta", el correo se muestra pero no se edita.
 */
export const actualizarPerfil = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);

    const nombre = name.trim();
    if (nombre.length === 0) throw new Error("Indica un nombre");

    await ctx.db.patch(user._id, { name: nombre });
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

    // Quitarle el rol de Dueña a la última que queda deja al equipo sin administradora.
    const objetivo = await ctx.db.get(usuarioId);
    if (objetivo === null) throw new Error("Ese usuario ya no existe");
    if (objetivo.rol === "propietaria" && rol !== "propietaria") {
      await assertQuedaAlgunaDuena(ctx, usuarioId);
    }

    // El email va por `asignarEmail`: valida el formato, lo normaliza, exige
    // que no lo tenga ya otra persona y mueve con él la credencial de
    // contraseña. Cambiarlo aquí a mano dejaría a esa persona con dos
    // identidades distintas según la puerta por la que entre.
    await asignarEmail(ctx, usuarioId, email);
    await ctx.db.patch(usuarioId, { name: nombre, rol });
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
      throw new Error("No puedes eliminar tu propia cuenta");
    }

    // Protección 2: el equipo nunca puede quedarse sin Dueña.
    const objetivo = await ctx.db.get(usuarioId);
    if (objetivo === null) throw new Error("Ese usuario ya no existe");
    if (objetivo.rol === "propietaria") {
      await assertQuedaAlgunaDuena(ctx, usuarioId);
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
 * persona con contraseña, y antes hay que decidir cómo entra por primera vez:
 * invitación por email o contraseña provisional. Mientras tanto se provisiona
 * desde el terminal, con las dos mutaciones internas de aquí abajo.
 */

// ---------------------------------------------------------------------------
// Provisión desde el terminal — JES-83.
//
// Son `internalMutation`: no las alcanza el navegador, solo el CLI de Convex,
// que se autentica con la clave del despliegue. Es a propósito. Dan de alta un
// perfil SIN credencial, que es justo lo que hace falta para entrar con Google:
// esa puerta (`auth.ts`) exige que el email ya sea un usuario del CRM, y no
// crea ninguno.
//
//   npx convex run users:provisionarUsuario \
//     '{"email":"alguien@ejemplo.com","name":"Alguien","rol":"comercial"}'
//
//   npx convex run users:cambiarEmailUsuario \
//     '{"emailActual":"viejo@ejemplo.com","emailNuevo":"nuevo@ejemplo.com"}'
//
// Añade `--prod` para tocar producción en vez de desarrollo.
// ---------------------------------------------------------------------------

/**
 * Da de alta un perfil, o actualiza el nombre y el rol si ese email ya existe.
 * No crea contraseña: quien se provisione así entra con Google.
 */
export const provisionarUsuario = internalMutation({
  args: { email: v.string(), name: v.string(), rol: rolUsuario },
  handler: async (ctx, { email, name, rol }) => {
    const nombre = name.trim();
    if (nombre.length === 0) throw new Error("Indica un nombre");
    if (!esEmailValido(email)) throw new Error("Introduce un email válido");
    const correo = normalizaEmail(email);

    const existente = await buscarUsuarioPorEmail(ctx.db, correo);

    if (existente === null) {
      const usuarioId = await ctx.db.insert("users", {
        email: correo,
        name: nombre,
        rol,
      });
      return { accion: "creado" as const, usuarioId, email: correo, rol };
    }

    if (existente.rol === "propietaria" && rol !== "propietaria") {
      await assertQuedaAlgunaDuena(ctx, existente._id);
    }
    await ctx.db.patch(existente._id, { name: nombre, rol });
    return {
      accion: "actualizado" as const,
      usuarioId: existente._id,
      email: correo,
      rol,
    };
  },
});

/**
 * Cambia el email de alguien que ya está en el equipo, conservando su historial:
 * sus interacciones, ventas y seguimientos apuntan a su `_id`, no a su correo.
 *
 * OJO con el efecto secundario, que es buscado: si esa persona ya había entrado
 * con Google, su cuenta de Google deja de abrir la puerta en el siguiente
 * intento, porque el correo con el que se identifica ya no corresponde a ningún
 * usuario provisionado. Cambiar el email es, de hecho, revocar el Google
 * anterior.
 */
export const cambiarEmailUsuario = internalMutation({
  args: { emailActual: v.string(), emailNuevo: v.string() },
  handler: async (ctx, { emailActual, emailNuevo }) => {
    const usuario = await buscarUsuarioPorEmail(ctx.db, emailActual);
    if (usuario === null) {
      throw new Error(`No hay ningún usuario con ${emailActual}`);
    }

    const de = usuario.email ?? "";
    const resultado = await asignarEmail(ctx, usuario._id, emailNuevo);

    return {
      usuarioId: usuario._id,
      de,
      a: resultado.email,
      cambiado: resultado.cambiado,
      rol: usuario.rol ?? "comercial",
      contrasenaMovida: resultado.contrasenaMovida,
    };
  },
});

/** El equipo nunca puede quedarse sin Dueña, tampoco desde el terminal. */
async function assertQuedaAlgunaDuena(ctx: MutationCtx, excepto: Id<"users">) {
  const duenas = (await ctx.db.query("users").collect()).filter(
    (u) => u.rol === "propietaria" && u._id !== excepto,
  );
  if (duenas.length === 0) {
    throw new Error("El equipo no puede quedarse sin nadie que lo lleve");
  }
}
