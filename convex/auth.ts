import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";

/**
 * Proveedor de autenticación — el punto de integración que el prototipo dejaba
 * marcado como simulacro. Email y contraseña, sin proveedores externos.
 *
 * Implementa parte de JES-38 y JES-47.
 *
 * El campo `rol` viaja en el alta: quien crea la cuenta decide si es
 * "propietaria" o "comercial". Por defecto, "comercial" — dar permisos de más
 * por descuido es peor que quedarse corto.
 */
const VibeCRMPassword = Password<DataModel>({
  profile(params) {
    return {
      email: params.email as string,
      name: (params.name as string) ?? "",
      rol: (params.rol as "propietaria" | "comercial") ?? "comercial",
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [VibeCRMPassword],
});
