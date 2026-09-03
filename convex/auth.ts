import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { buscarUsuarioPorEmail, normalizaEmail } from "./helpers";

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

const VibeCRMPassword = Password<DataModel>({
  profile(params) {
    return {
      email: params.email as string,
      name: (params.name as string) ?? "",
      rol: (params.rol as "propietaria" | "comercial") ?? "comercial",
      // Viaja hasta el guard de abajo; no se guarda en la base.
      codigoAlta: (params.codigoAlta as string) ?? "",
    };
  },
});

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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [VibeCRMPassword, VibeCRMGoogle],
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

      if (email.length === 0) throw new Error("Hace falta un email");

      // Si la Dueña ya creó el perfil, la credencial se engancha a ÉL en vez de
      // duplicar la persona. Y entonces el rol es el que ella asignó: nunca el
      // que venga en la petición.
      const existente = await buscarUsuarioPorEmail(db, email);
      if (existente !== null) return existente._id;

      return await db.insert("users", {
        email,
        name: String(profile.name ?? ""),
        rol: profile.rol === "propietaria" ? "propietaria" : "comercial",
      });
    },
  },
});
