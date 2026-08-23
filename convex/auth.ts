import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Autenticación — email y contraseña, sin proveedores externos.
 * Implementa parte de JES-38 y JES-47.
 *
 * EL REGISTRO PÚBLICO ESTÁ CERRADO.
 *
 * `signIn` es una acción pública: cualquiera con la URL del despliegue puede
 * llamarla con `flow: "signUp"` sin pasar por la web. Por eso el cerrojo no
 * puede estar en la pantalla de login —quitar un botón no cierra nada—, sino
 * aquí, en `createOrUpdateUser`, que es lo único que se ejecuta al dar de alta
 * una cuenta y lo hace en el servidor.
 *
 * Dar de alta exige un código que vive en la variable de entorno `CODIGO_ALTA`
 * del despliegue. Si esa variable NO existe, no hay alta posible: es el estado
 * por defecto, y el que debe tener producción. Mientras JES-69 no construya el
 * alta desde la pantalla de Equipo, ese código es la única forma de crear la
 * primera cuenta, y se usa desde el terminal, nunca desde la web.
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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [VibeCRMPassword],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
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

      const email = String(profile.email ?? "").trim();
      if (email.length === 0) throw new Error("Hace falta un email");

      // Si la Dueña ya creó el perfil, la credencial se engancha a ÉL en vez de
      // duplicar la persona. Y entonces el rol es el que ella asignó: nunca el
      // que venga en la petición.
      // `createOrUpdateUser` recibe un ctx sin tipar contra nuestro esquema, así
      // que se recupera el tipado para poder usar el índice `email`.
      const db = ctx.db as unknown as MutationCtx["db"];

      const existente = await db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (existente !== null) return existente._id;

      return await db.insert("users", {
        email,
        name: String(profile.name ?? ""),
        rol: profile.rol === "propietaria" ? "propietaria" : "comercial",
      });
    },
  },
});
