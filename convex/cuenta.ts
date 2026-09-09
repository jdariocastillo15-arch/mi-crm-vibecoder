import { ConvexError, v } from "convex/values";
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

/**
 * Los motivos por los que este cambio se rechaza, como CÓDIGO y no como frase.
 *
 * POR QUÉ CÓDIGOS Y NO MENSAJES. Un `throw new Error("texto")` **pierde su
 * texto en producción**: Convex no revela a los clientes nada de los errores no
 * controlados, y llega un escueto `Server Error`. Está en su documentación de
 * errores de aplicación. La primera versión de este fichero lanzaba prosa y la
 * pantalla la reconocía comparando cadenas, así que en producción no habría
 * distinguido una contraseña equivocada de un bloqueo por intentos: las dos
 * habrían caído en el mismo aviso genérico. Lo encontró auditoría.
 *
 * `ConvexError` es la excepción a esa regla: su `data` **sí** viaja al cliente
 * en producción. Por eso el motivo va ahí, y el texto lo pone la pantalla.
 *
 * El repositorio ya esquivaba el problema en el login (`login/page.tsx:201`),
 * que ignora el mensaje del servidor y fija el suyo. Aquí no basta con eso
 * porque hay que distinguir dos casos, y de ahí el código.
 *
 * Existe la lista equivalente en `OverlayCambiarContrasena.tsx`. No se comparte
 * un módulo a propósito: importar desde `convex/` arrastraría al navegador todo
 * el servidor. Un código que la pantalla no reconozca cae en su mensaje
 * genérico, así que separarlas degrada bien.
 */
type MotivoDelRechazo =
  | "sin_sesion"
  | "sin_contrasena"
  | "sin_correo"
  | "actual_vacia"
  | "muy_corta"
  | "actual_incorrecta"
  | "demasiados_intentos"
  | "cuenta_ajena";

function rechaza(motivo: MotivoDelRechazo): never {
  throw new ConvexError({ motivo });
}

/**
 * Traduce a motivo los códigos crudos que lanza la librería.
 *
 * `retrieveAccount` hace `throw new Error(codigo)` con la cadena tal cual
 * (`implementation/index.js:373-379`), así que aquí sí hay que mirar el texto:
 * es lo único que da. Lo que sale de esta función ya es un código nuestro.
 */
function motivoDeCredencial(error: unknown): MotivoDelRechazo {
  const crudo = error instanceof Error ? error.message : String(error);

  if (crudo.includes("InvalidSecret")) return "actual_incorrecta";

  // El contador es el MISMO que bloquea el login
  // (`retrieveAccountWithCredentials.js:26-33`), y eso es deseable: impide usar
  // esta pantalla como un oráculo ilimitado de contraseñas con una sesión
  // robada. El precio es que fallar aquí también cierra el login un rato.
  if (crudo.includes("TooManyFailedAttempts")) return "demasiados_intentos";

  // No debería llegar: la pantalla esconde la opción y esta acción la vuelve a
  // comprobar antes de llamar.
  if (crudo.includes("InvalidAccountId")) return "sin_contrasena";

  // Cualquier otra cosa —un fallo de la librería, de la red o de la query
  // interna— NO se disfraza de motivo conocido. Se deja subir tal cual para que
  // la pantalla la trate con su mensaje genérico, que es lo que pidió
  // auditoría.
  throw error;
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
      rechaza("sin_sesion");
    }

    const quien = await ctx.runQuery(internal.cuenta.datosParaCambio, {});

    // El token dice una cosa y la base otra: no se sigue adelante. No debería
    // pasar —las dos salen de la misma sesión— pero esta acción escribe una
    // credencial, y ahí no se avanza con una identidad que no cuadra.
    if (quien.usuarioId !== usuarioDelToken) rechaza("sin_sesion");

    if (!quien.tieneContrasena) rechaza("sin_contrasena");
    if (quien.email.length === 0) rechaza("sin_correo");

    // La actual es OBLIGATORIA en el servidor. Sin esta línea, una sesión
    // robada cambiaría la contraseña sin conocer la anterior, que es justo lo
    // que impide que el robo se vuelva permanente.
    //
    // Se mira la longitud SIN recortar espacios: una contraseña puede ser
    // espacios, y normalizar una credencial para validarla es cambiarla.
    if (actual.length === 0) rechaza("actual_vacia");
    if (nueva.length < MINIMO_CONTRASENA) rechaza("muy_corta");

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
      rechaza(motivoDeCredencial(error));
    }

    // La cuenta se busca por CORREO, no por usuario, así que hay que confirmar
    // que la que ha salido es la de quien llama. La propia librería hace esta
    // misma comprobación en el flujo de recuperación
    // (`providers/Password.js:117`). Sin ella, un desajuste entre `users.email`
    // y `providerAccountId` dejaría reescribir la credencial de otra persona.
    if (cuenta.userId !== usuarioDelToken) rechaza("cuenta_ajena");

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
