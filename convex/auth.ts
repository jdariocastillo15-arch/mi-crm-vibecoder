import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { buscarUsuarioPorEmail, normalizaEmail } from "./helpers";
import { RecuperarPorCorreo } from "./recuperar";

/**
 * Autenticación — dos puertas: email con contraseña, y Google.
 * Implementa parte de JES-38, JES-47 y JES-83.
 *
 * EL REGISTRO PÚBLICO ESTÁ CERRADO, POR LAS DOS PUERTAS.
 *
 * `signIn` es una acción pública: cualquiera con la URL del despliegue puede
 * llamarla con `flow: "signUp"` sin pasar por la web. Por eso el cerrojo no
 * puede estar en la pantalla de login —quitar un botón no cierra nada—, sino
 * aquí, en `createOrUpdateUser`, que es lo único que se ejecuta al dar de alta
 * una cuenta y lo hace en el servidor.
 *
 * Cada puerta tiene su cerrojo, porque no son la misma cosa:
 *
 * - CONTRASEÑA: dar de alta exige un código que vive en la variable de entorno
 *   `CODIGO_ALTA` del despliegue. Si esa variable NO existe, no hay alta
 *   posible: es el estado por defecto, y el que debe tener producción.
 * - GOOGLE: Google dice QUIÉN es alguien, no si puede pasar. Entrar con Google
 *   exige que ese email YA sea un usuario del CRM, provisionado antes por la
 *   Dueña. Google nunca crea usuarios, ni siquiera con `CODIGO_ALTA`.
 *
 * Mientras JES-69 no construya el alta desde la pantalla de Equipo, los perfiles
 * se provisionan desde el terminal — ver `users.ts#provisionarUsuario`.
 */

const passwordBase = Password<DataModel>({
  // Por dónde sale el código de recuperación. Ver `recuperar.ts` (JES-87).
  reset: RecuperarPorCorreo,

  profile(params) {
    const crudo = String(params.email ?? "");
    // Normalizado AQUÍ, antes de que la librería lo toque: este email es el
    // que `@convex-dev/auth` usa como `account.id` de la credencial, tanto al
    // dar de alta como al iniciar sesión (`providers/Password.ts:136`, usado
    // en `:147` y `:159`). Si saliera en crudo, un alta escrita
    // "Marta@Acme.es" dejaría `users.email` en minúsculas y
    // `authAccounts.providerAccountId` con mayúsculas: dos formas del mismo
    // correo, y un login que ya no encuentra su propia cuenta.
    const email = normalizaEmail(crudo);

    // ---- Recuperación: el correo tiene que venir ya canónico --------------
    // Sin esto, el código de 8 dígitos se puede reventar a fuerza bruta.
    //
    // El límite de intentos de la librería se lleva por `params.email` TAL
    // COMO LLEGA (`mutations/verifyCodeAndSignIn.js:23`), no por la cuenta que
    // acaba encontrando. Como "marta@x.com", "Marta@x.com" y "marta@x.com "
    // son la misma cuenta pero tres claves distintas —y los espacios finales
    // no se acaban nunca—, cada variante estrenaría su propio cupo de diez
    // intentos por hora y el techo dejaría de existir.
    //
    // Esta comprobación es el ÚNICO sitio donde se puede cortar: `profile()`
    // se ejecuta en todos los flujos y lo primero de todo
    // (`providers/Password.js:56`), mientras que el `authorize` del proveedor
    // de correo corre después de haber buscado el código, demasiado tarde.
    // Los dos controles hacen falta; no son el mismo repetido.
    //
    // Quien teclea el correo no se entera: la pantalla lo normaliza antes de
    // llamar, en los dos pasos.
    const flow = String(params.flow ?? "");
    if (
      (flow === "reset" || flow === "reset-verification") &&
      crudo !== email
    ) {
      throw new Error("El correo debe llegar en su forma canónica");
    }

    return {
      email,
      name: (params.name as string) ?? "",
      // OJO: aquí NO se devuelve `rol`, y es deliberado. El rol es de quien
      // provisiona, nunca de quien se da de alta. Ver `createOrUpdateUser`.
      // Viaja hasta el guard de abajo; no se guarda en la base.
      codigoAlta: (params.codigoAlta as string) ?? "",
    };
  },
});

/**
 * El mismo mensaje para todo lo que, si se distinguiera, diría si un correo
 * tiene cuenta en el CRM.
 *
 * La librería lanza el error crudo de la mutación (`implementation/index.js`,
 * `retrieveAccount`), y son distintos: `InvalidAccountId` cuando el correo no
 * tiene credencial, `InvalidSecret` cuando la contraseña falla,
 * `TooManyFailedAttempts` cuando la cuenta está bloqueada, y
 * `Account X already exists` al intentar darse de alta sobre un correo que ya
 * la tiene (`mutations/createAccountFromCredentials.js:30`).
 *
 * Y llegan al navegador: `convex/browser/logging.js:113-116` mete el mensaje
 * del servidor en el error que ve el cliente, también para `Error` normales.
 * Que la pantalla los tape es cosmética; el mensaje viaja en la respuesta.
 *
 * Eso convertía la puerta de la contraseña en un listado de quién usa el CRM,
 * justo lo que JES-80 y JES-83 se esforzaron en no revelar. Con `signUp` ni
 * siquiera hacía falta conocer `CODIGO_ALTA`: bastaba comparar el error de un
 * correo con credencial con el de uno sin ella.
 */
const ERRORES_QUE_DELATAN = [
  "InvalidAccountId",
  "InvalidSecret",
  "TooManyFailedAttempts",
  "already exists",
];

const MENSAJE_UNIFORME = "Email o contraseña incorrectos";

/**
 * El proveedor de contraseña, con los errores delatores uniformados.
 *
 * Se envuelve `options.authorize` y no el `authorize` de arriba porque el de
 * arriba es un señuelo: `providers/ConvexCredentials.js:29-35` deja ahí un
 * `async () => null`, y `provider_utils.js:73` fusiona `options` encima antes
 * de usarlo. Envolver el de arriba no haría nada en absoluto, y en silencio.
 *
 * `options` es API interna de la librería. Por eso se comprueba AL CARGAR el
 * módulo: si una actualización cambia esa forma, el despliegue falla en vez de
 * quedarse sin la protección sin que nadie se entere. Un agujero callado es
 * peor que un arranque roto.
 */
type ProveedorConOptions = typeof passwordBase & {
  options?: {
    authorize?: (
      params: Record<string, unknown>,
      ctx: unknown,
    ) => Promise<unknown>;
  };
};

const conOptions = passwordBase as ProveedorConOptions;
const autorizarOriginal = conOptions.options?.authorize;

if (typeof autorizarOriginal !== "function") {
  throw new Error(
    "@convex-dev/auth ha cambiado: `Password().options.authorize` ya no es una " +
      "función, así que los errores del login vuelven a delatar qué correos " +
      "tienen cuenta. Revisar `convex/auth.ts` antes de desplegar (JES-90).",
  );
}

const VibeCRMPassword = {
  ...conOptions,
  options: {
    ...conOptions.options,
    authorize: async (params: Record<string, unknown>, ctx: unknown) => {
      try {
        return await autorizarOriginal(params, ctx);
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        if (ERRORES_QUE_DELATAN.some((pista) => mensaje.includes(pista))) {
          throw new Error(MENSAJE_UNIFORME);
        }
        // Los demás pasan tal cual: «El registro está cerrado» y «El correo
        // debe llegar en su forma canónica» son nuestros, no distinguen unas
        // cuentas de otras, y sirven para diagnosticar.
        throw error;
      }
    },
  },
} as typeof passwordBase;

/**
 * Google, con el `email_verified` que manda de verdad.
 *
 * El perfil que Convex Auth arma por defecto para un proveedor OAuth se queda
 * con id, nombre, email e imagen, y DA POR VERIFICADO todo lo que llegue por
 * ahí (`provider_utils.ts`, `defaultProfile`). Aquí la diferencia importa: sin
 * este dato, cualquiera podría crear una cuenta de Google sobre el correo de
 * otra persona del equipo y entrar con su rol.
 */
const VibeCRMGoogle = Google({
  profile(perfil) {
    return {
      id: perfil.sub,
      name: perfil.name,
      email: perfil.email,
      image: perfil.picture,
      emailVerified: perfil.email_verified === true,
    };
  },
});

const DIA_MS = 1000 * 60 * 60 * 24;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [VibeCRMPassword, VibeCRMGoogle],

  /**
   * Cuánto dura una sesión. Sin esto rigen los valores por defecto de la
   * librería —30 días de vida Y 30 de inactividad, `implementation/sessions.js:4`
   * y `refreshTokens.js:2`—, que para un CRM con datos de clientes es mucho.
   *
   * Ojo con lo que significa `inactiveDurationMs`: NO es "el portátil robado
   * deja de servir en una semana". Es el tiempo que puede pasar sin renovar el
   * token. Quien tenga la sesión y siga usándola la mantiene hasta los 30 días
   * de `totalDurationMs`; lo que caduca en 7 es la sesión que nadie toca.
   *
   * Y se aplica a los tokens que se emitan DESPUÉS: no recalcula las fechas de
   * los que ya están vivos. La entrada en vigor es gradual.
   */
  session: {
    totalDurationMs: 30 * DIA_MS,
    inactiveDurationMs: 7 * DIA_MS,
  },

  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, type, profile }) {
      // `createOrUpdateUser` recibe un ctx sin tipar contra nuestro esquema, así
      // que se recupera el tipado para poder consultar la tabla `users`.
      const db = ctx.db as unknown as MutationCtx["db"];
      const email = normalizaEmail(String(profile.email ?? ""));

      // ---- Puerta de Google -------------------------------------------------
      // Va PRIMERO, antes del atajo de `existingUserId`, y esto es deliberado.
      //
      // A partir del segundo login con Google ya existe la fila de
      // `authAccounts`, así que `existingUserId` llega relleno. Si se devolviera
      // ahí mismo, esa cuenta seguiría entrando para siempre aunque su email
      // hubiera dejado de estar provisionado. Se revalida en TODOS los logins.
      //
      // Este bloque no escribe nada: ni crea usuarios ni los modifica. La fila
      // de `authAccounts` sí la crea la librería después, si aquí se acepta.
      if (type === "oauth") {
        if (profile.emailVerified !== true) {
          throw new Error("El registro está cerrado");
        }
        if (email.length === 0) {
          throw new Error("El registro está cerrado");
        }

        // Lanza si hubiera dos usuarios con ese email: mejor no entrar que
        // entrar en la cuenta equivocada.
        const provisionado = await buscarUsuarioPorEmail(db, email);
        if (provisionado === null) {
          // Mismo mensaje siempre: no hay que ayudar a distinguir "esta cuenta
          // no tiene acceso" de "este CRM no existe".
          throw new Error("El registro está cerrado");
        }

        // La cuenta de Google estaba enganchada a otra persona: alguien cambió
        // un email por el medio. No se reengancha sola, se cierra la puerta.
        if (existingUserId !== null && existingUserId !== provisionado._id) {
          throw new Error("El registro está cerrado");
        }

        // Manda el CRM, no Google: ni el rol ni el nombre se sobrescriben con
        // lo que venga de fuera. Google solo ha dicho quién es.
        return provisionado._id;
      }

      // ---- Puerta de la contraseña -----------------------------------------
      // Iniciar sesión en una cuenta que ya existe no pasa por aquí, pero si
      // algún día lo hiciera, no es un alta y se deja pasar.
      if (existingUserId !== null) return existingUserId;

      const esperado = process.env.CODIGO_ALTA;
      const aportado = String(profile.codigoAlta ?? "");
      if (!esperado || aportado !== esperado) {
        // Mismo mensaje tanto si falta el código como si es incorrecto: no hay
        // que ayudar a distinguir "cerrado" de "casi".
        throw new Error("El registro está cerrado");
      }

      if (email.length === 0) throw new Error("El registro está cerrado");

      // El alta NO crea usuarios: solo le pone credencial a alguien que el CRM
      // ya conocía. Es la misma regla que Google, y ahora las dos puertas se
      // comportan igual.
      //
      // Antes esto insertaba en `users` con `rol: profile.rol`, es decir, con
      // el rol que viniera EN LA PETICIÓN. Quien conociera `CODIGO_ALTA` no se
      // daba de alta como comercial: se daba de alta como propietaria, y con
      // eso mandaba en el CRM entero. Una sola llamada a `auth:signIn`.
      //
      // Al quitar el insert, `CODIGO_ALTA` deja de poder crear cuentas y de
      // poder repartir roles. Pasa a ser lo que de verdad hace falta: el
      // permiso para que alguien ya autorizado se ponga contraseña.
      //
      // El primer usuario de un despliegue nuevo se sigue creando con
      // `users.ts#provisionarUsuario`, que es interna y solo se invoca desde el
      // terminal.
      const existente = await buscarUsuarioPorEmail(db, email);
      if (existente === null) throw new Error("El registro está cerrado");
      return existente._id;
    },
  },
});
