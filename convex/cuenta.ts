import { v } from "convex/values";
import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import {
  PROVEEDOR_PASSWORD,
  requireUser,
  tieneContrasenaPropia,
} from "./helpers";

/**
 * "Mi cuenta" — implementa la parte de servidor de JES-49.
 *
 * Cambiar la contraseña teniéndola. Hasta ahora la única forma de cambiarla era
 * pedir un código por correo, es decir, usar el flujo de «la he olvidado» para
 * algo que no se ha olvidado. Es el mismo error de trato que JES-92 arregló en
 * el login.
 *
 * Editar el nombre NO está aquí: ya vive en `users.ts#actualizarPerfil`, que es
 * una mutación normal. Y el correo no se edita desde aquí en absoluto — es lo
 * que decide si una cuenta de Google abre la puerta (JES-83), así que lo asigna
 * quien lleva el equipo.
 */

/**
 * El mínimo de la librería, no una preferencia nuestra:
 * `validateDefaultPasswordRequirements` rechaza menos de 8
 * (`providers/Password.js:171-175`).
 *
 * Se comprueba AQUÍ además de en la pantalla porque
 * `modifyAccountCredentials` **no** aplica esa validación: escribe el hash de
 * lo que le den. Sin esta línea, «Mi cuenta» podría dejar guardada una
 * contraseña de cuatro letras que el propio login habría rechazado al darse de
 * alta, y esa persona seguiría entrando con ella.
 *
 * El prototipo dice seis (`CRM Shell.dc.html:1215`). Está desfasado: manda la
 * librería. Existe la misma constante en `lib/constants.ts`; si cambias una,
 * cambia la otra.
 */
export const MINIMO_CONTRASENA = 8;

/** El mismo texto para todo lo que sea «tu sesión no vale». */
const SIN_SESION = "No hay sesión iniciada";

/**
 * Traduce los códigos crudos de la librería.
 *
 * `retrieveAccount` lanza `new Error(codigo)` con la cadena tal cual
 * (`implementation/index.js:373-379`). Aquí SÍ se puede ser preciso, al revés
 * que en `auth.ts`: quien llama ya tiene sesión, así que distinguir los casos no
 * revela qué correos existen. Lo que no se puede es soltar «InvalidSecret» a la
 * cara de nadie.
 */
function traduceErrorDeCredencial(error: unknown): string {
  const codigo = error instanceof Error ? error.message : String(error);

  if (codigo.includes("InvalidSecret")) {
    return "La contraseña actual no es correcta";
  }

  // El contador es el MISMO que bloquea el login
  // (`retrieveAccountWithCredentials.js:26-33`), y eso es deseable: impide usar
  // esta pantalla como un oráculo ilimitado de contraseñas con una sesión
  // robada. El precio es que fallar aquí también cierra el login un rato.
  //
  // No se promete una duración. `rateLimit.js#getRateLimitState` repone
  // intentos de forma continua, a razón de diez por hora, así que a los pocos
  // minutos vuelve a haber alguno: decir «una hora» sería mentir.
  if (codigo.includes("TooManyFailedAttempts")) {
    return "Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo";
  }

  // No debería llegar: la pantalla esconde la opción y esta acción la vuelve a
  // comprobar antes de llamar. Si llega, es un fallo de verdad y se dice.
  if (codigo.includes("InvalidAccountId")) {
    return "Esta cuenta no tiene ninguna contraseña que cambiar";
  }

  return "No se ha podido cambiar la contraseña";
}

/**
 * Quién pide el cambio, con las tres comprobaciones de `requireUser`: sesión
 * viva, sesión suya y ficha no dada de baja.
 *
 * Va en una query aparte porque una `action` no toca la base de datos. El
 * contexto de autenticación viaja con `ctx.runQuery`, así que `requireUser` ve
 * aquí exactamente la misma sesión que ve la acción.
 */
export const datosParaCambio = internalQuery({
  args: {},
  returns: v.object({
    usuarioId: v.id("users"),
    email: v.string(),
    tieneContrasena: v.boolean(),
  }),
  handler: async (ctx) => {
    const usuario = await requireUser(ctx);
    return {
      usuarioId: usuario._id,
      email: usuario.email ?? "",
      tieneContrasena: await tieneContrasenaPropia(ctx, usuario),
    };
  },
});

/**
 * Cambiar la propia contraseña, sabiendo la actual.
 *
 * Es una `action` porque las tres funciones de la librería que hacen falta
 * —`retrieveAccount`, `modifyAccountCredentials`, `invalidateSessions`— exigen
 * contexto de acción. Y una acción NO es transaccional: eso está contemplado en
 * el último paso, no ignorado.
 *
 * TODO lo que autoriza se comprueba aquí. Que la pantalla esconda la opción es
 * comodidad, no seguridad: esta acción es pública y se puede llamar a pelo.
 */
export const cambiarContrasena = action({
  args: { actual: v.string(), nueva: v.string() },
  returns: v.object({ sesionesCerradas: v.boolean() }),
  handler: async (ctx, { actual, nueva }) => {
    const usuarioDelToken = await getAuthUserId(ctx);
    const sesionActual = await getAuthSessionId(ctx);
    if (usuarioDelToken === null || sesionActual === null) {
      throw new Error(SIN_SESION);
    }

    const quien = await ctx.runQuery(internal.cuenta.datosParaCambio, {});

    // El token dice una cosa y la base otra: no se sigue adelante. No debería
    // pasar —las dos salen de la misma sesión— pero esta acción escribe una
    // credencial, y ahí no se avanza con una identidad que no cuadra.
    if (quien.usuarioId !== usuarioDelToken) throw new Error(SIN_SESION);

    if (!quien.tieneContrasena) {
      throw new Error("Todavía no has establecido una contraseña");
    }
    if (quien.email.length === 0) {
      throw new Error("Esta cuenta no tiene ningún correo asociado");
    }

    // La actual es OBLIGATORIA en el servidor. Sin esta línea, una sesión
    // robada cambiaría la contraseña sin conocer la anterior, que es justo lo
    // que impide que el robo se vuelva permanente.
    if (actual.length === 0) {
      throw new Error("Introduce tu contraseña actual");
    }
    if (nueva.length < MINIMO_CONTRASENA) {
      throw new Error(
        `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres`,
      );
    }

    // Comprobar la actual. Lanza con el código crudo si no cuadra, y de paso
    // apunta el intento fallido en el mismo contador que frena el login.
    let cuenta;
    try {
      const encontrada = await retrieveAccount<DataModel>(ctx, {
        provider: PROVEEDOR_PASSWORD,
        account: { id: quien.email, secret: actual },
      });
      cuenta = encontrada.account;
    } catch (error) {
      throw new Error(traduceErrorDeCredencial(error));
    }

    // La cuenta se busca por CORREO, no por usuario, así que hay que confirmar
    // que la que ha salido es la de quien llama. La propia librería hace esta
    // misma comprobación en el flujo de recuperación
    // (`providers/Password.js:117`). Sin ella, un desajuste entre `users.email`
    // y `providerAccountId` dejaría reescribir la credencial de otra persona.
    if (cuenta.userId !== usuarioDelToken) throw new Error(SIN_SESION);

    await modifyAccountCredentials<DataModel>(ctx, {
      provider: PROVEEDOR_PASSWORD,
      account: { id: quien.email, secret: nueva },
    });

    // A partir de aquí la contraseña YA está cambiada y no hay vuelta atrás:
    // esto es una acción, no una mutación. Si echar a las demás sesiones falla,
    // no se puede presentar toda la operación como fallida —sería mentir, y la
    // persona repetiría el cambio creyendo que no se guardó—. Se devuelve el
    // resultado parcial y que lo cuente la pantalla.
    //
    // Es el mismo trato que `OverlayUsuario` le da al aviso por correo del
    // alta: lo principal vale, lo accesorio se informa.
    let sesionesCerradas = true;
    try {
      await invalidateSessions<DataModel>(ctx, {
        userId: usuarioDelToken,
        except: [sesionActual],
      });
    } catch {
      sesionesCerradas = false;
    }

    return { sesionesCerradas };
  },
});
