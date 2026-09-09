import { v } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { EmailConfig } from "@convex-dev/auth/server";
import { normalizaEmail } from "./helpers";

/**
 * Recuperar la contraseña con un código enviado por correo — implementa JES-87.
 *
 * Convex Auth ya trae el ciclo entero en los flujos `reset` y
 * `reset-verification` de `Password`. Lo único que le falta es por dónde sale
 * el correo, y eso es este fichero: un proveedor de email de Auth.js que manda
 * el código con Resend.
 *
 * Se construye A MANO en vez de con el ayudante `Email()` de la librería, y no
 * es capricho. El docstring de `Email()` promete que se le puede pasar un
 * `authorize` propio, pero `providers/Email.js:30-50` arma el objeto literal
 * SIN hacer spread de la configuración: solo respeta `sendVerificationRequest`
 * y tira `authorize`, `id` y `maxAge`. Necesitamos los tres.
 */

/** Lo que dura un código. Explícito a propósito: omitirlo deja 24 horas. */
const CADUCIDAD_SEGUNDOS = 15 * 60;

/** Cuántos códigos se le mandan a un correo por ventana, y de cuánto es. */
const MAXIMO_POR_VENTANA = 3;
const VENTANA_MS = 60 * 60 * 1000;

const DIGITOS = 8;

/** Compartido con `equipo.ts`: un solo remitente para todo lo que sale. */
export const REMITENTE = "Vibe CRM <no-responder@vibe-crm-pro.net>";

/**
 * Un código de 8 dígitos, sin sesgo.
 *
 * Se descartan los bytes desde 250 en vez de hacer `% 10` con todos: 256 no es
 * múltiplo de 10, así que los dígitos del 0 al 5 saldrían un 17% más a menudo
 * que el resto. Con 8 dígitos y un atacante contando frecuencias, eso regala
 * entropía gratis.
 *
 * No se usa `oslo`, que es lo que enseña la documentación de Convex Auth: no
 * está instalada. `@oslojs/crypto` sí lo está, pero solo como dependencia
 * transitiva de `@convex-dev/auth`, y construir sobre una transitiva es
 * firmar que se romperá en cuanto esa librería cambie de idea.
 */
function generaCodigo(): string {
  const digitos: string[] = [];
  const bytes = new Uint8Array(32);
  while (digitos.length < DIGITOS) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= 250) continue;
      digitos.push(String(byte % 10));
      if (digitos.length === DIGITOS) break;
    }
  }
  return digitos.join("");
}

/**
 * RESERVA un envío y dice si se puede mandar.
 *
 * Existe porque el límite de Convex Auth NO cubre esta fase. En
 * `implementation/mutations/retrieveAccountWithCredentials.js:25` la
 * comprobación está dentro de un `if (account.secret !== undefined)`, y el
 * flujo "reset" no lleva secret: sin esto, pedir códigos sería gratis.
 *
 * SE RESERVA ANTES DE ENVIAR, Y ESO ES EL PUNTO. Antes esto se llamaba
 * `registrarEnvio` y corría dentro de `sendVerificationRequest`, o sea DESPUÉS
 * de que la librería hubiera generado el código nuevo y borrado el anterior
 * (`implementation/signIn.js:62` genera, `:79` envía; el borrado está en
 * `mutations/createVerificationCode.js:47`). El cupo protegía el buzón, no el
 * código: cualquiera, sin sesión, podía pedir códigos en bucle para el correo
 * de otra persona y dejarle el suyo invalidado una y otra vez. Quien reservó
 * es `auth.ts`, en el envoltorio de `authorize`, que corre antes que nada de
 * eso. Ver el comentario de `limitesRecuperacion` en `schema.ts`.
 *
 * Es una `mutation`, así que la lectura y el incremento son una sola
 * transacción: dos peticiones simultáneas no pueden ver el mismo hueco libre.
 * Por eso se reserva de verdad en vez de apuntar el envío al terminar.
 *
 * El email llega ya normalizado, así que el cupo es POR CUENTA y no por forma
 * de escribirla.
 *
 * Devuelve la `ventanaInicio` con la que se contó para que quien reservó pueda
 * devolver EXACTAMENTE su reserva si el envío falla, y ninguna otra.
 */
export const reservarEnvio = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const ahora = Date.now();
    const previo = await ctx.db
      .query("limitesRecuperacion")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (previo === null) {
      await ctx.db.insert("limitesRecuperacion", {
        email,
        enviados: 1,
        ventanaInicio: ahora,
      });
      return { permitido: true, ventanaInicio: ahora };
    }

    // Ventana caducada: se reinicia la cuenta en vez de acumular para siempre.
    if (ahora - previo.ventanaInicio >= VENTANA_MS) {
      await ctx.db.patch(previo._id, { enviados: 1, ventanaInicio: ahora });
      return { permitido: true, ventanaInicio: ahora };
    }

    if (previo.enviados >= MAXIMO_POR_VENTANA) {
      return { permitido: false, ventanaInicio: previo.ventanaInicio };
    }

    await ctx.db.patch(previo._id, { enviados: previo.enviados + 1 });
    return { permitido: true, ventanaInicio: previo.ventanaInicio };
  },
});

/**
 * Devuelve una reserva que no llegó a convertirse en correo.
 *
 * Sin esto, un fallo de Resend gastaba cupo igual: tres intentos con el
 * proveedor caído dejaban a esa persona una hora sin poder entrar y sin haber
 * recibido nada. Como el envío vive en una `action`, la reserva ya está
 * confirmada cuando el `fetch` revienta y no se deshace sola.
 *
 * `ventanaInicio` es la que devolvió la reserva, y es lo que hace que esto
 * devuelva SOLO la suya: si la ventana ya rotó —otra petición la reinició
 * mientras tanto—, los contadores de ahora son de otra tanda y no se tocan.
 * Y nunca se pone a cero nada: se resta uno, que es lo que se había sumado.
 */
export const liberarReserva = internalMutation({
  args: { email: v.string(), ventanaInicio: v.number() },
  handler: async (ctx, { email, ventanaInicio }) => {
    const previo = await ctx.db
      .query("limitesRecuperacion")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (previo === null) return null;
    // Otra ventana: la reserva que se quiere devolver ya no está en esta cuenta.
    if (previo.ventanaInicio !== ventanaInicio) return null;
    if (previo.enviados <= 0) return null;

    await ctx.db.patch(previo._id, { enviados: previo.enviados - 1 });
    return null;
  },
});

/**
 * Manda el código con Resend.
 *
 * El segundo parámetro es el `ctx` de la acción. NO está en el tipo de Auth.js
 * —`providers/email.d.ts:29` declara un solo argumento— pero la librería lo
 * pasa igualmente: ver el `@ts-expect-error` que ella misma se deja en
 * `implementation/signIn.js:93-95`, "Figure out typing for email providers so
 * they can access ctx". De ahí el cast de más abajo.
 */
/**
 * Marca los errores que son DEL ENVÍO y no de otra cosa.
 *
 * `auth.ts` devuelve la reserva del cupo cuando el correo no sale, y necesita
 * distinguir eso de cualquier otra excepción. La diferencia no es cosmética:
 * para cuando algo falla, la librería YA ha borrado el código que la persona
 * tenía y ha puesto otro (`implementation/signIn.js:62`). Devolver la reserva
 * ante un error cualquiera regalaría intentos gratis a quien provoque uno a
 * propósito después de esa línea, y el código ajeno se podría tirar en bucle
 * sin gastar cupo. Solo se perdona lo que de verdad impidió que saliera el
 * correo.
 */
export const FALLO_DE_ENVIO = "FALLO_DE_ENVIO";

async function enviarCodigo(
  params: { identifier: string; token: string; expires: Date },
  ctx: GenericActionCtx<DataModel>,
): Promise<void> {
  try {
    await mandarPorResend(params, ctx);
  } catch (error) {
    // Se reetiqueta sin perder el detalle, que hace falta en el log.
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(`${FALLO_DE_ENVIO}: ${detalle}`);
  }
}

async function mandarPorResend(
  params: { identifier: string; token: string; expires: Date },
  ctx: GenericActionCtx<DataModel>,
): Promise<void> {
  // `createVerificationCode.js:32` devuelve como identificador el email tal
  // como llegó en los params. El guard de `auth.ts` ya garantiza que en los
  // flujos de recuperación viene canónico; se normaliza igual, porque de este
  // valor depende que el cupo sea uno por cuenta.
  const email = normalizaEmail(params.identifier);

  // AQUÍ YA NO SE MIRA EL CUPO, y es el arreglo entero. Cuando se miraba aquí
  // llegaba tarde: la librería ya había generado el código nuevo y borrado el
  // que la persona tenía en el buzón. La reserva la hace `auth.ts` en el
  // envoltorio de `authorize`, antes de que exista código nuevo que sustituya
  // al viejo. Si el envío de más abajo falla, esa misma reserva se devuelve
  // allí, que es donde se sabe con qué ventana se contó.

  const clave = process.env.AUTH_RESEND_KEY;
  if (!clave) {
    throw new Error("Falta AUTH_RESEND_KEY en el despliegue");
  }

  // El mismo código sirve para dos situaciones distintas, y el correo no puede
  // tratarlas igual: a quien estrena contraseña no se le dice que "ha pedido
  // cambiarla", porque no tenía ninguna. Es el fondo de JES-92, y arreglarlo
  // solo en la pantalla lo dejaría a medias.
  const inicial = await ctx.runQuery(internal.acceso.esConfiguracionInicial, {
    email,
  });

  const minutos = Math.round(CADUCIDAD_SEGUNDOS / 60);
  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [email],
      subject: inicial
        ? `Tu código para configurar tu contraseña de Vibe CRM: ${params.token}`
        : `Tu código para entrar en Vibe CRM: ${params.token}`,
      text: cuerpoTexto(params.token, minutos, inicial),
      html: cuerpoHtml(params.token, minutos, inicial),
    }),
  });

  if (!respuesta.ok) {
    // El detalle va al log del despliegue, no al navegador.
    const detalle = await respuesta.text();
    throw new Error(`Resend respondió ${respuesta.status}: ${detalle}`);
  }
}

function cuerpoTexto(
  codigo: string,
  minutos: number,
  inicial: boolean,
): string {
  return [
    inicial
      ? "Ya puedes entrar en Vibe CRM. Solo te falta elegir tu contraseña."
      : "Has pedido cambiar tu contraseña de Vibe CRM.",
    "",
    `Tu código es: ${codigo}`,
    "",
    `Caduca en ${minutos} minutos y solo sirve una vez.`,
    inicial
      ? "Si caduca, vuelve a poner tu correo en la pantalla de entrada y te\nmandamos otro."
      : "Si no has sido tú, no hace falta que hagas nada: sin este código,\ntu contraseña no cambia.",
  ].join("\n");
}

/**
 * El correo, en HTML. Estilos en línea y nada más: los clientes de correo
 * ignoran las hojas de estilo, así que aquí no valen los tokens del design
 * system. El verde es el mismo `--color-primary` del CRM, escrito a mano.
 */
function cuerpoHtml(
  codigo: string,
  minutos: number,
  inicial: boolean,
): string {
  const entradilla = inicial
    ? "Ya puedes entrar. Solo te falta elegir tu contraseña."
    : "Has pedido cambiar tu contraseña.";
  const cierre = inicial
    ? `Caduca en ${minutos} minutos y solo sirve una vez. Si caduca, vuelve a
            poner tu correo en la pantalla de entrada y te mandamos otro.`
    : `Caduca en ${minutos} minutos y solo sirve una vez. Si no has sido tú,
            no hace falta que hagas nada: sin este código, tu contraseña no cambia.`;

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f7f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1c1a">
    <table role="presentation" style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #e4e7e4;border-radius:12px;border-collapse:separate">
      <tr>
        <td style="padding:28px 24px">
          <p style="margin:0 0 4px;font-size:17px;font-weight:600">Vibe CRM</p>
          <p style="margin:0 0 20px;font-size:14px;color:#5c625c">
            ${entradilla}
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#5c625c">Tu código es:</p>
          <p style="margin:0 0 20px;font-size:30px;font-weight:600;letter-spacing:5px;color:#2f7d3f">
            ${codigo}
          </p>
          <p style="margin:0;font-size:13px;color:#5c625c">
            ${cierre}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * El proveedor que se le enchufa a `Password` en la opción `reset`.
 *
 * Los dos controles de abajo NO son el mismo control repetido, y hay que
 * conservar los dos:
 *
 * - El guard de `auth.ts#profile` rechaza los correos no canónicos ANTES de
 *   llegar al verificador. Es lo único que impide repartir los intentos entre
 *   variantes del mismo correo, porque el límite de la librería se lleva por
 *   `params.email` tal cual (`mutations/verifyCodeAndSignIn.js:23`).
 * - Este `authorize` protege que el código corresponda a la cuenta. Corre
 *   DESPUÉS de encontrar un código que coincide, así que llega tarde para lo
 *   anterior.
 *
 * Quitar cualquiera de los dos deja un agujero distinto.
 */
export const RecuperarPorCorreo: EmailConfig = {
  id: "resend-otp-reset",
  type: "email",
  name: "Recuperar contraseña",
  from: REMITENTE,
  maxAge: CADUCIDAD_SEGUNDOS,
  generateVerificationToken: generaCodigo,

  /**
   * Comparación EXACTA, no normalizada.
   *
   * Es deliberado: si algún día desaparece el guard de `profile`, aquí siguen
   * rechazándose las variantes y no se reabre la fuerza bruta del código.
   * Normalizar en este punto las aceptaría, y cada una tendría su propio cupo
   * de intentos.
   */
  authorize: async (params, account) => {
    if (
      typeof params.email !== "string" ||
      params.email !== account.providerAccountId
    ) {
      throw new Error("El código no corresponde a ese correo");
    }
  },

  // El `ctx` que necesita `enviarCodigo` no cabe en el tipo de Auth.js; la
  // propia librería se salta ese tipo al invocarlo. Ver el comentario de la
  // función.
  sendVerificationRequest:
    enviarCodigo as unknown as EmailConfig["sendVerificationRequest"],

  options: {},
};
