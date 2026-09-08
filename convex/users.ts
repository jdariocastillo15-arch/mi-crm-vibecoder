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
    // Las bajas no salen: no están en el equipo. Su ficha se conserva para que
    // el historial siga diciendo quién hizo cada cosa, no para listarlas.
    // Filtrar AQUÍ, en el servidor, es lo que hace que también desaparezcan del
    // desplegable de responsable sin tocar ese componente.
    const users = (await ctx.db.query("users").collect()).filter(
      (u) => u.bajaEn === undefined,
    );
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

    // Primero lo que permite entrar como ella: cuentas, sesiones, tokens de
    // refresco y códigos de verificación. Sin esto quedaban vivos —incluido el
    // hash de su contraseña— y rompían el login de quien reutilizara ese
    // correo. Ver `borrarCredenciales` (JES-90).
    await borrarCredenciales(ctx, usuarioId);

    // Sus pendientes pasan a quien la da de baja. Si se quedaran a su nombre
    // no los vería nadie: ella ya no entra, y su nombre desaparece de las
    // listas. Solo los que están SIN HACER — los terminados son historial y se
    // quedan como estaban, diciendo la verdad de quién los hizo.
    const suyos = await ctx.db
      .query("seguimientos")
      .withIndex("by_responsable", (q) => q.eq("responsableId", usuarioId))
      .collect();
    let reasignados = 0;
    for (const seguimiento of suyos) {
      if (seguimiento.hecho) continue;
      await ctx.db.patch(seguimiento._id, { responsableId: actual._id });
      reasignados += 1;
    }

    // Y la ficha se CONSERVA, marcada de baja. No se borra, y es deliberado:
    // `seguimientos.responsableId` e `interacciones.autorId` son referencias
    // obligatorias, así que borrar la fila las dejaba apuntando a alguien que
    // ya no existe. Conservándola, el historial sigue diciendo quién hizo cada
    // cosa aunque esa persona ya no forme parte del equipo.
    //
    // El acceso, en cambio, se ha ido entero: sin credenciales, y las puertas
    // de `auth.ts`, `acceso.ts` y `helpers.ts#requireUser` la rechazan.
    await ctx.db.patch(usuarioId, { bajaEn: Date.now() });

    return { reasignados };
  },
});

/**
 * Dar de alta a alguien del equipo — implementa JES-69.
 *
 * Es corto, y lo es gracias a JES-92: basta con crear la ficha. Esa persona
 * entra en el CRM, pone su correo, y el login se encarga del resto —le crea la
 * credencial y le manda el código para elegir contraseña—. Aquí NO se crean
 * credenciales, no se generan códigos y no se toca `authAccounts`.
 *
 * Antes de JES-92 esto era la parte cara: había que montarle la credencial y
 * una invitación con código, porque si no el login lo mandaba a «Recuperar
 * contraseña», que es tratar como despistado a quien nunca tuvo ninguna.
 *
 * El aviso por correo va aparte, en `equipo.ts`, y a propósito: si falla, el
 * alta sigue siendo válida y esa persona puede entrar igual.
 */
export const crearUsuario = mutation({
  args: { name: v.string(), email: v.string(), rol: rolUsuario },
  handler: async (ctx, { name, email, rol }) => {
    await requirePropietaria(ctx);

    const nombre = name.trim();
    if (nombre.length === 0) throw new Error("Indica un nombre");
    if (!esEmailValido(email)) throw new Error("Introduce un email válido");

    // Si ese correo es de alguien que se dio de baja, se REACTIVA su ficha en
    // vez de fallar por duplicado. Es lo que espera cualquiera al volver a
    // añadir a una persona, y evita fichas fantasma que bloquean su propio
    // correo para siempre. Recupera su historial, que es lo suyo.
    const existente = await buscarUsuarioPorEmail(ctx.db, normalizaEmail(email));
    if (existente !== null) {
      if (existente.bajaEn === undefined) {
        throw new Error("Ya hay alguien con ese email");
      }
      await ctx.db.patch(existente._id, {
        name: nombre,
        rol,
        bajaEn: undefined,
      });
      return { usuarioId: existente._id, reactivada: true };
    }

    const usuarioId = await ctx.db.insert("users", { name: nombre, rol });
    // El correo va por `asignarEmail` y no en el insert: valida el formato, lo
    // deja en su forma canónica, exige que no lo tenga nadie más y arrastraría
    // la credencial de contraseña si existiera. Escribirlo a mano dejaría dos
    // formas del mismo correo según la puerta por la que se entre.
    await asignarEmail(ctx, usuarioId, email);

    return { usuarioId, reactivada: false };
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

// ---------------------------------------------------------------------------
// Borrar de verdad a alguien — JES-90.
//
// Convex Auth reparte lo que permite entrar como una persona en cuatro tablas,
// y borrar su fila de `users` no toca ninguna. Antes quedaban vivas: el hash de
// su contraseña, su cuenta de Google, sus sesiones y sus tokens de refresco.
//
// Se notó en desarrollo, donde había una credencial de contraseña apuntando a
// un usuario que ya no existía. No daba acceso —`requireUser` comprueba que el
// usuario esté, y falla— pero sí rompía el login de forma difícil de entender
// si alguien reutilizaba ese correo: la búsqueda encontraba la credencial
// vieja y devolvía un usuario nulo.
// ---------------------------------------------------------------------------

/** Una cuenta y los códigos de verificación que colgaban de ella. */
async function borrarCuenta(ctx: MutationCtx, cuentaId: Id<"authAccounts">) {
  const codigos = await ctx.db
    .query("authVerificationCodes")
    .withIndex("accountId", (q) => q.eq("accountId", cuentaId))
    .collect();
  for (const codigo of codigos) await ctx.db.delete(codigo._id);
  await ctx.db.delete(cuentaId);
}

/** Una sesión y los tokens de refresco que colgaban de ella. */
async function borrarSesion(ctx: MutationCtx, sesionId: Id<"authSessions">) {
  const tokens = await ctx.db
    .query("authRefreshTokens")
    .withIndex("sessionId", (q) => q.eq("sessionId", sesionId))
    .collect();
  for (const token of tokens) await ctx.db.delete(token._id);
  await ctx.db.delete(sesionId);
}

/**
 * Todo lo que permite entrar como esa persona. No toca su historial de
 * negocio: interacciones, ventas y seguimientos siguen donde estaban.
 *
 * Las cuentas se buscan por `userIdAndProvider` usando solo el primer campo
 * del índice; `authAccounts` no tiene un índice de `userId` a secas.
 */
async function borrarCredenciales(ctx: MutationCtx, usuarioId: Id<"users">) {
  const sesiones = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", usuarioId))
    .collect();
  for (const sesion of sesiones) await borrarSesion(ctx, sesion._id);

  const cuentas = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", usuarioId))
    .collect();
  for (const cuenta of cuentas) await borrarCuenta(ctx, cuenta._id);

  return { sesiones: sesiones.length, cuentas: cuentas.length };
}

/**
 * Barre las credenciales que apuntan a usuarios que ya no existen.
 *
 * Es para limpiar lo que dejaron las eliminaciones anteriores a JES-90. Usa las
 * mismas funciones que el borrado normal, así que tampoco deja códigos sueltos
 * colgando de las cuentas que se lleva.
 *
 *   npx convex run users:sanearHuerfanas
 *
 * Añade `--prod` para producción. Es idempotente: si no hay nada, no hace nada.
 */
export const sanearHuerfanas = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cuentas = await ctx.db.query("authAccounts").collect();
    const cuentasBorradas: string[] = [];
    for (const cuenta of cuentas) {
      if ((await ctx.db.get(cuenta.userId)) !== null) continue;
      cuentasBorradas.push(`${cuenta.provider}:${cuenta.providerAccountId}`);
      await borrarCuenta(ctx, cuenta._id);
    }

    const sesiones = await ctx.db.query("authSessions").collect();
    let sesionesBorradas = 0;
    for (const sesion of sesiones) {
      if ((await ctx.db.get(sesion.userId)) !== null) continue;
      sesionesBorradas += 1;
      await borrarSesion(ctx, sesion._id);
    }

    return { cuentasBorradas, sesionesBorradas };
  },
});

/**
 * El equipo nunca puede quedarse sin Dueña, tampoco desde el terminal.
 *
 * Solo cuentan las ACTIVAS. Contar a una de baja sería peor que inútil: haría
 * creer que queda alguien al mando y dejaría quitarle el rol —o dar de baja— a
 * la última Dueña de verdad, con el equipo entero sin nadie que pueda
 * gestionarlo y sin forma de arreglarlo desde la propia aplicación.
 */
async function assertQuedaAlgunaDuena(ctx: MutationCtx, excepto: Id<"users">) {
  const duenas = (await ctx.db.query("users").collect()).filter(
    (u) =>
      u.rol === "propietaria" && u._id !== excepto && u.bajaEn === undefined,
  );
  if (duenas.length === 0) {
    throw new Error("El equipo no puede quedarse sin nadie que lo lleve");
  }
}
