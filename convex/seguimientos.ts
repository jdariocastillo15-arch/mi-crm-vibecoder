import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  requireUser,
  assertClienteExiste,
  hoy,
  diasDeRetraso,
  esFechaValida,
} from "./helpers";

/**
 * Seguimientos — el corazón del CRM. Implementa JES-55, JES-58, JES-59 y JES-60.
 *
 * Sustituye a los recordatorios calculados por días sin contacto del PRD
 * original: aquí cada seguimiento dice QUÉ hay que hacer, CUÁNDO y QUIÉN.
 *
 * ---
 *
 * QUIÉN PUEDE HACER QUÉ. Esto es una regla de producto, no un descuido:
 *
 * · Completar un seguimiento lo puede hacer CUALQUIERA del equipo, no solo su
 *   responsable. "Hoy" enseña los pendientes de todo el equipo a propósito, y
 *   la fila muestra el avatar de quién es responsable justamente porque puede
 *   ser otra persona. En un negocio de dos, si Marta ve que algo ya está hecho,
 *   tacharlo es lo correcto; obligar a que solo Carlos pueda cerrarlo dejaría
 *   la lista mintiendo, que es justo lo que este CRM viene a evitar.
 *
 * · Deshacer, en cambio, solo lo puede hacer QUIEN LO CERRÓ. Deshacer no es
 *   colaborar, es corregirse: la red de seguridad contra el toque accidental de
 *   quien acaba de dar al botón. Reabrir el cierre de otra persona sí sería
 *   pisarle el trabajo.
 *
 * Si algún día la regla cambia a "solo el responsable completa", el guard va en
 * `marcarHecho`, comparando con `responsableId`.
 */

/**
 * Los pendientes de todo el equipo, para la pantalla "Hoy".
 *
 * Devuelve el seguimiento con lo que la fila necesita pintar, para no obligar a
 * la pantalla a traerse la lista entera de clientes solo por un nombre.
 */
export const listPendientes = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    const pendientes = await ctx.db
      .query("seguimientos")
      .withIndex("by_hecho_vence", (q) => q.eq("hecho", false))
      .collect();

    const filas = await Promise.all(
      pendientes.map(async (seguimiento) => {
        const cliente = await ctx.db.get(seguimiento.clienteId);

        // Un seguimiento sin cliente no es accionable: no se puede pintar ni
        // navegar a ninguna parte. Se descarta, pero no en silencio — filtrar
        // sin dejar rastro escondería una corrupción de datos.
        if (cliente === null) {
          console.warn(
            `Seguimiento ${seguimiento._id} apunta a un cliente que no existe; se omite de "Hoy".`,
          );
          return null;
        }

        // El responsable SÍ puede faltar de verdad: borrar a alguien del equipo
        // deja vivos sus seguimientos (ver `users.eliminarUsuario` y JES-70).
        const responsable = await ctx.db.get(seguimiento.responsableId);

        return {
          ...seguimiento,
          cliente: { nombre: cliente.nombre, estado: cliente.estado },
          responsableNombre: responsable?.name ?? null,
        };
      }),
    );

    return filas.filter((f) => f !== null);
  },
});

export const listByCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUser(ctx);
    return await ctx.db
      .query("seguimientos")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();
  },
});

export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    accion: v.string(),
    vence: v.string(),
    /** Omitir para asignárselo a uno mismo, que es lo que hace "Nueva tarea". */
    responsableId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertClienteExiste(ctx, args.clienteId);

    const accion = args.accion.trim();
    if (accion.length === 0) throw new Error("Indica qué hay que hacer");

    // No basta el formato: "2026-02-30" lo pasa y luego rompe la clasificación.
    if (!esFechaValida(args.vence)) throw new Error("Indica una fecha");

    // El argumento es API pública: si viene, tiene que apuntar a alguien real.
    if (args.responsableId !== undefined) {
      const responsable = await ctx.db.get(args.responsableId);
      if (responsable === null) {
        throw new Error("Esa persona ya no está en el equipo");
      }
    }

    return await ctx.db.insert("seguimientos", {
      clienteId: args.clienteId,
      accion,
      vence: args.vence,
      hecho: false,
      responsableId: args.responsableId ?? user._id,
    });
  },
});

/**
 * Marcar hecho y deshacer.
 *
 * Las dos son TRANSICIONES DE ESTADO, no escrituras ciegas: leen primero y no
 * hacen nada si el seguimiento ya está donde se le pide que esté. Eso las hace
 * idempotentes y, sobre todo, cierra el rodeo de dos pasos — si `marcarHecho`
 * reescribiese `completadoPorId` sin mirar, bastaría con recompletar la tarea
 * de otra persona para quedarse con la autoría y poder deshacerla después.
 *
 * La interfaz aplica el cambio al instante y luego confirma con el servidor; si
 * esto falla, la pantalla revierte.
 */
export const marcarHecho = mutation({
  args: { seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { seguimientoId }) => {
    const user = await requireUser(ctx);

    const seguimiento = await ctx.db.get(seguimientoId);
    if (seguimiento === null) throw new Error("Ese seguimiento ya no existe");

    // Ya estaba cerrado: la autoría es de quien lo cerró primero, y no se toca.
    if (seguimiento.hecho) return;

    await ctx.db.patch(seguimientoId, {
      hecho: true,
      fechaHecho: hoy(),
      completadoPorId: user._id,
    });
  },
});

export const deshacer = mutation({
  args: { seguimientoId: v.id("seguimientos") },
  handler: async (ctx, { seguimientoId }) => {
    const user = await requireUser(ctx);

    const seguimiento = await ctx.db.get(seguimientoId);
    if (seguimiento === null) throw new Error("Ese seguimiento ya no existe");

    // Ya estaba abierto: deshacer dos veces, o deshacer algo que otra pestaña
    // ya reabrió, no es un fallo.
    if (!seguimiento.hecho) return;

    // Sin `completadoPorId` el seguimiento se cerró antes de que se guardara la
    // autoría. Dejarlo pasar sin más sería un agujero —cualquiera podría
    // reabrirlo—, y negárselo a todo el mundo lo dejaría cerrado para siempre.
    // Se cae en su responsable, que es el dueño más razonable de una fila así.
    const cerroDuenio = seguimiento.completadoPorId ?? seguimiento.responsableId;
    if (cerroDuenio !== user._id) {
      throw new Error("Lo completó otra persona");
    }

    await ctx.db.patch(seguimientoId, {
      hecho: false,
      fechaHecho: undefined,
      completadoPorId: undefined,
    });
  },
});

/**
 * Clasificación en Atrasado / Para hoy / Próxima.
 *
 * Vive también en `lib/seguimientos.ts` para que la interfaz pueda agrupar sin
 * ida y vuelta al servidor. Las dos usan la misma regla: si cambias una,
 * cambia la otra.
 */
export function clasificar(vence: string, referencia: string = hoy()) {
  const dias = diasDeRetraso(vence, referencia);
  if (dias > 0) return "atrasado" as const;
  if (dias === 0) return "hoy" as const;
  return "proxima" as const;
}
