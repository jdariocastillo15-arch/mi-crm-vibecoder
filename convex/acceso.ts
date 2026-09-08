import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import { buscarUsuarioPorEmail, esEmailValido, normalizaEmail } from "./helpers";

/**
 * El primer paso del login — implementa JES-92.
 *
 * El login pedía correo y contraseña a la vez, y eso dejaba fuera a quien
 * NUNCA ha tenido contraseña: lo único que se le podía ofrecer era «Recuperar
 * contraseña», que es tratarla como si se hubiera despistado. No olvidó nada.
 *
 * Ahora se pide primero el correo y esta función decide qué toca:
 *
 *   ficha con contraseña ya elegida  →  "contrasena"  (y no pasa nada más)
 *   ficha con contraseña pendiente   →  "codigo"      (prepara y manda)
 *   correo desconocido               →  "codigo"      (y NO pasa nada)
 *
 * Que el correo desconocido responda igual que la ficha pendiente es el punto:
 * sin eso, esta pantalla sería un listado de quién usa el CRM.
 */

/** El proveedor de credenciales de contraseña, tal como lo llama la librería. */
const PROVEEDOR = "password";

/**
 * Un secreto que no conoce nadie.
 *
 * La cuenta de contraseña tiene que existir para que el flujo de código de
 * JES-87 tenga a qué agarrarse —busca la cuenta ANTES de generar nada—, pero
 * su contraseña todavía no es de nadie. Se rellena con 32 bytes aleatorios que
 * no se guardan, no se enseñan y no se pueden adivinar: la persona elegirá la
 * suya con el código, y hasta entonces esa credencial no abre nada.
 */
function secretoInservible(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Decide el segundo paso del login.
 *
 * Es una MUTACIÓN, no una acción, y eso es deliberado: así solo lee la base y
 * programa el trabajo lento, en vez de esperar a Resend con la respuesta en la
 * mano. Dos consecuencias, las dos buscadas:
 *
 *   · Las dos ramas tardan prácticamente lo mismo. Si esta función esperase al
 *     correo, el reloj diría lo que la respuesta se calla.
 *   · Que Resend falle o que el cupo esté agotado NO cambia lo que se devuelve.
 *     Un error visible aquí sería el chivato por la puerta de atrás.
 *
 * RIESGO ACEPTADO POR EL OWNER, y conviene no maquillarlo: quien ya tiene
 * contraseña es identificable probando su correo, y nada lo frena. El límite de
 * tres por hora de `recuperar.ts` es del ENVÍO, así que protege buzones, no
 * esta rama, que no manda nada. Es una reversión parcial y consciente del
 * hallazgo 2 de la auditoría (JES-90), a cambio de no tratar como despistado a
 * quien nunca tuvo contraseña. Está escrito en JES-92.
 *
 * LO QUE EL RELOJ TODAVÍA CUENTA, medido y no supuesto. Con 25 llamadas por
 * rama contra el despliegue de desarrollo: desconocido 79,0 ms de mediana, con
 * contraseña 81,3 ms, y pendiente 87,3 ms. Los dos primeros son
 * indistinguibles dentro del ruido —y daría igual, porque su respuesta ya los
 * separa—, pero desconocido y pendiente COMPARTEN respuesta y difieren unos 8
 * ms, porque el pendiente además escribe la marca y programa el envío. Con
 * suficientes muestras eso distingue «está en el CRM y aún no ha elegido
 * contraseña» de «no está en el CRM».
 *
 * Igualarlo del todo exigiría programar trabajo también para los desconocidos,
 * y eso convierte cada sondeo en una invocación de más: una palanca de
 * amplificación a cambio de unos milisegundos. No compensa, así que queda como
 * residuo declarado y no como algo que se nos haya pasado.
 */
export const estadoAcceso = mutation({
  args: { email: v.string() },
  returns: v.union(v.literal("contrasena"), v.literal("codigo")),
  handler: async (ctx, { email: crudo }) => {
    const email = normalizaEmail(crudo);

    // Un correo mal escrito no merece una respuesta distinta: sería otra forma
    // de contestar preguntas que no se han hecho.
    if (!esEmailValido(email)) return "codigo" as const;

    const usuario = await buscarUsuarioPorEmail(ctx.db, email);

    // La misma consulta se hace SIEMPRE, exista la ficha o no, y su resultado
    // se tira cuando no hay ficha. Es relleno deliberado, para que la rama del
    // desconocido no salga antes por hacer menos trabajo.
    //
    // Medido antes y después: NO cambia nada, 8,3 ms de diferencia frente a
    // 8,8. La distancia entre las dos ramas no está en esta lectura sino en la
    // escritura y la programación de más abajo. Se deja igualmente porque no
    // cuesta nada y quita una asimetría; que no baste está dicho arriba.
    const cuenta = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PROVEEDOR).eq("providerAccountId", email),
      )
      .unique();

    // Desconocido: la misma respuesta que una ficha pendiente, y sin efectos.
    // Ni se crea nada, ni se manda nada, ni se apunta nada.
    if (usuario === null) return "codigo" as const;

    // Dada de baja: se responde igual que a un desconocido y no se hace nada.
    // La ficha existe —se conserva para el historial— pero no abre puertas, y
    // esta es una de ellas: sin este corte, la baja podría estrenar contraseña.
    if (usuario.bajaEn !== undefined) return "codigo" as const;

    // La contraseña ya es suya: se la pedimos y aquí no se toca nada.
    if (cuenta !== null && usuario.contrasenaPendiente !== true) {
      return "contrasena" as const;
    }

    // Todo lo demás es «tiene que elegir contraseña»: la ficha provisionada sin
    // credencial, y la que ya empezó el proceso y vuelve a intentarlo.
    await ctx.db.patch(usuario._id, { contrasenaPendiente: true });
    await ctx.scheduler.runAfter(0, internal.acceso.prepararYEnviar, {
      email,
      faltaCuenta: cuenta === null,
    });

    return "codigo" as const;
  },
});

/**
 * Le crea la credencial si le falta, y pide el código.
 *
 * Va aparte y programada porque `createAccount` necesita contexto de acción y
 * porque mandar el correo no puede retrasar —ni condicionar— la respuesta del
 * paso 1.
 */
export const prepararYEnviar = internalAction({
  args: { email: v.string(), faltaCuenta: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { email, faltaCuenta }) => {
    // Se vuelve a comprobar, y no es redundante: esto es trabajo PROGRAMADO.
    // Uno lanzado justo antes de una baja se ejecuta después de ella, y sin
    // esta comprobación le crearía la credencial a quien acaba de perder el
    // acceso. Lo señaló auditoría.
    const sigueActiva = await ctx.runQuery(internal.acceso.estaActiva, {
      email,
    });
    if (!sigueActiva) return null;

    if (faltaCuenta) {
      try {
        await createAccount<DataModel>(ctx, {
          provider: PROVEEDOR,
          account: { id: email, secret: secretoInservible() },
          // `altaDeServidor` es la marca que reconoce `auth.ts`: dice que esto
          // viene del servidor y no de un navegador. No se guarda en `users`,
          // porque nuestro `createOrUpdateUser` devuelve el id de la ficha y la
          // librería no llega a insertar nada (`implementation/users.js:16-20`),
          // igual que ya pasa hoy con `codigoAlta`.
          profile: { email, altaDeServidor: true } as unknown as {
            email: string;
          },
        });
      } catch (error) {
        // Dos peticiones a la vez para el mismo correo: una crea la cuenta y la
        // otra llega tarde. No es un fallo, es la carrera esperada — se sigue y
        // se manda el código igual.
        //
        // Lo que NO se hace, ni aquí ni en ningún sitio, es reemplazar el
        // secreto de una cuenta que ya existe: si esa persona ya eligió su
        // contraseña, un reintento no puede pisársela.
        const mensaje = error instanceof Error ? error.message : String(error);
        if (!mensaje.includes("already exists")) throw error;
      }
    }

    // El envío es el de JES-87 tal cual, por la puerta de siempre: genera el
    // código, guarda su hash, aplica el cupo de tres por hora y manda el correo.
    // Aquí no se duplica nada de eso.
    await ctx.runAction(api.auth.signIn, {
      provider: PROVEEDOR,
      params: { email, flow: "reset" },
    });

    return null;
  },
});

/** ¿La ficha de este correo existe y sigue activa? */
export const estaActiva = internalQuery({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const usuario = await buscarUsuarioPorEmail(ctx.db, normalizaEmail(email));
    return usuario !== null && usuario.bajaEn === undefined;
  },
});

/**
 * ¿Este código es para estrenar contraseña, o para cambiar la que ya se tenía?
 *
 * Lo pregunta `recuperar.ts` al redactar el correo. No cambia nada de lo que
 * hace el flujo: cambia lo que dice. Decirle «has pedido cambiar tu contraseña»
 * a quien nunca ha tenido ninguna es exactamente el problema que arregla
 * JES-92, y arreglarlo en la pantalla y no en el correo sería dejarlo a medias.
 */
export const esConfiguracionInicial = internalQuery({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const usuario = await buscarUsuarioPorEmail(ctx.db, normalizaEmail(email));
    return usuario?.contrasenaPendiente === true;
  },
});

/**
 * Da por elegida la contraseña. INTERNA, y eso es el arreglo.
 *
 * La primera versión era una mutación pública que retiraba la marca a
 * cualquiera con sesión, apoyándose en que «una sesión válida solo existe si la
 * contraseña se guardó». Eso era FALSO: también hay sesiones de Google. Una
 * persona provisionada que entrara con Google podía retirarse la marca sin
 * haber elegido contraseña, y el login pasaba a pedirle un secreto que nadie
 * conocía. Lo encontró auditoría (M4).
 *
 * Ahora solo la llama `auth.ts`, desde el envoltorio de `authorize`, y solo
 * cuando el flujo de contraseña ha devuelto bien. Esa es la única señal fiable:
 * `Password.js:121-126` guarda con `modifyAccountCredentials` y DESPUÉS
 * devuelve, así que ver ese retorno es ver la contraseña ya persistida.
 *
 * Dónde NO se podía poner, para que no se intente otra vez:
 *
 *   · En el callback `createOrUpdateUser`: ahí llega `type: "verification"` y
 *     corre ANTES de guardar (`verifyCodeAndSignIn.ts:215`), así que quitaría
 *     la marca aunque el guardado fallase después.
 *   · En `afterUserCreatedOrUpdated`: con un `createOrUpdateUser` propio, la
 *     librería devuelve antes de llegar a él (`implementation/users.js:16-20`).
 *
 * Si algo falla por el camino la marca se queda puesta, que es el lado correcto
 * en el que equivocarse: como mucho se le vuelve a pedir el código.
 */
export const marcarContrasenaElegida = internalMutation({
  args: { usuarioId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { usuarioId }) => {
    const usuario = await ctx.db.get(usuarioId);
    if (usuario === null || usuario.contrasenaPendiente !== true) return null;

    await ctx.db.patch(usuarioId, { contrasenaPendiente: undefined });
    return null;
  },
});
