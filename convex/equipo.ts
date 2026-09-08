import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePropietaria } from "./helpers";
import { REMITENTE } from "./recuperar";

/**
 * El aviso de que te han añadido al equipo — implementa parte de JES-69.
 *
 * NO LLEVA CÓDIGO, NI TOKEN, NI ENLACE DE UN SOLO USO, y eso es lo importante.
 *
 * Los filtros de seguridad del correo —Safe Links de Microsoft 365, URL Defense
 * de Proofpoint, los antivirus de escritorio— **abren los enlaces antes que la
 * persona**, para comprobar a dónde llevan. Un enlace de un solo uso llega
 * gastado, y es un fallo malísimo de diagnosticar porque solo le pasa a quien
 * tiene ese filtro. Aquí no hay nada que gastar: el único enlace es a la
 * portada, que se puede abrir mil veces sin consecuencias.
 *
 * El código lo pide la propia persona cuando está delante del teclado, y se lo
 * manda el flujo de JES-92. Este correo solo le dice que ya puede.
 *
 * Va SEPARADO del alta a propósito: si el envío falla, la ficha ya está creada
 * y esa persona puede entrar igual. Se le dice a la Dueña, no se deshace nada.
 */

/** A dónde se le manda. Sin `SITE_URL` no se inventa una URL. */
function portada(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("Falta SITE_URL en el despliegue");
  return url.replace(/\/+$/, "");
}

/**
 * ¿Puede quien pide esto avisar a esa persona, y sigue siendo avisable?
 *
 * La autorización vive AQUÍ, en el servidor, y no en la pantalla que llama:
 * `requirePropietaria` exige sesión viva y rol de Dueña. Y se comprueba que el
 * destinatario existe y **está activo**, para que esto no acabe siendo una
 * forma de mandarle correos a quien se dio de baja.
 */
export const datosDelAviso = internalQuery({
  args: { usuarioId: v.id("users") },
  returns: v.object({ email: v.string(), nombre: v.string() }),
  handler: async (ctx, { usuarioId }) => {
    await requirePropietaria(ctx);

    const destinatario = await ctx.db.get(usuarioId);
    if (destinatario === null || destinatario.bajaEn !== undefined) {
      throw new Error("Esa persona ya no está en el equipo");
    }

    const email = destinatario.email ?? "";
    if (email.length === 0) throw new Error("Esa persona no tiene correo");

    return { email, nombre: destinatario.name ?? "" };
  },
});

/**
 * Manda el aviso. Devuelve si salió, para que la pantalla lo pueda contar.
 *
 * No lanza cuando Resend falla: el alta ya está hecha y lo que hay que decirle
 * a la Dueña es «se ha creado, pero el aviso no salió», no un error que parezca
 * que ha fallado todo. El detalle del fallo va al log del despliegue.
 */
export const avisarDeAlta = action({
  args: { usuarioId: v.id("users") },
  returns: v.object({ enviado: v.boolean() }),
  handler: async (ctx, { usuarioId }) => {
    const { email, nombre } = await ctx.runQuery(
      internal.equipo.datosDelAviso,
      { usuarioId },
    );

    const clave = process.env.AUTH_RESEND_KEY;
    if (!clave) {
      console.error("Aviso de alta no enviado: falta AUTH_RESEND_KEY");
      return { enviado: false };
    }

    try {
      const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: REMITENTE,
          to: [email],
          subject: "Ya tienes acceso a Vibe CRM",
          text: cuerpoTexto(nombre),
          html: cuerpoHtml(nombre),
        }),
      });

      if (!respuesta.ok) {
        console.error(
          `Aviso de alta no enviado: Resend respondió ${respuesta.status}`,
          await respuesta.text(),
        );
        return { enviado: false };
      }

      return { enviado: true };
    } catch (error) {
      console.error("Aviso de alta no enviado:", error);
      return { enviado: false };
    }
  },
});

function saludo(nombre: string): string {
  const corto = nombre.trim().split(/\s+/)[0] ?? "";
  return corto.length > 0 ? `Hola, ${corto}.` : "Hola.";
}

function cuerpoTexto(nombre: string): string {
  return [
    saludo(nombre),
    "",
    "Te han añadido al equipo de Vibe CRM.",
    "",
    `Entra en ${portada()}, pon tu correo y dale a Continuar.`,
    "Te llegará un código para que elijas tu contraseña.",
    "",
    "No hace falta que nadie te pase nada más.",
  ].join("\n");
}

/**
 * El nombre lo teclea la Dueña, así que esto no es una vía de ataque abierta a
 * cualquiera; pero un apellido con `&` o unas comillas romperían el marcado sin
 * necesidad de mala fe, y lo que se interpola en HTML se escapa. Sin excepciones
 * por lo poco probable que parezca el caso.
 */
function escapaHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * En HTML, con estilos en línea: los clientes de correo ignoran las hojas de
 * estilo, así que aquí no valen los tokens del design system. El verde es el
 * mismo `--color-primary` del CRM, escrito a mano.
 *
 * El enlace es a la portada y nada más. Que lo abra un escáner de antivirus
 * antes que la persona da exactamente igual: no consume nada.
 */
function cuerpoHtml(nombre: string): string {
  const url = portada();
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f7f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1c1a">
    <table role="presentation" style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #e4e7e4;border-radius:12px;border-collapse:separate">
      <tr>
        <td style="padding:28px 24px">
          <p style="margin:0 0 4px;font-size:17px;font-weight:600">Vibe CRM</p>
          <p style="margin:0 0 20px;font-size:14px;color:#5c625c">
            ${escapaHtml(saludo(nombre))} Te han añadido al equipo.
          </p>
          <p style="margin:0 0 20px;font-size:14px">
            Entra, pon tu correo y dale a Continuar. Te llegará un código para
            que elijas tu contraseña.
          </p>
          <p style="margin:0 0 20px">
            <a href="${url}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#2f7d3f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">Entrar en Vibe CRM</a>
          </p>
          <p style="margin:0;font-size:13px;color:#5c625c">
            No hace falta que nadie te pase nada más.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
