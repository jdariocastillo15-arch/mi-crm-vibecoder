import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { credenciales, pedirAGmail, tokenDeAcceso } from "./gmail";
import { hoy, requireUser } from "./helpers";
import { direccionCorreo } from "./schema";
import {
  clasificar,
  consultaGmail,
  mapaDeClientes,
  siguienteVentana,
  ventanaInicial,
  type ListadoGmail,
  type MensajeGmail,
} from "../lib/correo";

/**
 * Traer el correo del buzón de la empresa a la ficha del cliente — JES-103.
 *
 * Esto solo orquesta. Las dos decisiones difíciles —qué ventana se pide y qué
 * se hace con cada mensaje— viven en `lib/correo.ts`, en funciones puras, para
 * poder provocar los casos raros con respuestas inventadas.
 *
 * Es la primera vez que `convex/` importa de `lib/`. Se hace porque esas
 * funciones no son de la pantalla ni del servidor: son las reglas, y tenían que
 * quedar donde se pueden ejecutar sin Convex delante.
 */

/** Cuántas páginas de cien se recorren como mucho en una pasada. */
const PAGINAS_POR_PASADA = 5;

/** Cuántos mensajes se le piden a Gmail a la vez. */
const EN_PARALELO = 10;

/** Las únicas cabeceras que se piden. El cuerpo no se descarga nunca. */
const CABECERAS = ["From", "To", "Cc", "Subject", "Date"]
  .map((cabecera) => `&metadataHeaders=${cabecera}`)
  .join("");

type CorreoNuevo = Omit<Doc<"correos">, "_id" | "_creationTime">;

/**
 * Los correos de un cliente, para su historial.
 *
 * Calcada de `interacciones.listByCliente`, pero sin cruzar el autor: un correo
 * no lo anota nadie del equipo. Con `requireUser` basta, igual que allí: este
 * CRM no tiene clientes "de" nadie y quien entra ve todas las fichas.
 */
export const listByCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUser(ctx);

    return await ctx.db
      .query("correos")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();
  },
});

/** Por dónde iba la lectura, y las fichas contra las que emparejar. */
export const datosDeLaPasada = internalQuery({
  args: { buzon: v.string() },
  handler: async (ctx, { buzon }) => {
    const estado = await ctx.db
      .query("sincronizacionCorreo")
      .withIndex("buzon", (q) => q.eq("buzon", buzon))
      .unique();

    // La tabla entera, y a propósito: el mapa tiene que ver TODAS las fichas
    // para poder detectar las que comparten email. Es lo mismo que hace
    // `helpers.ts#buscarUsuarioPorEmail` con el equipo, y por el mismo motivo.
    const clientes = await ctx.db.query("clientes").collect();

    return {
      ventana: estado
        ? {
            desdeEpoch: estado.desdeEpoch,
            hastaEpoch: estado.hastaEpoch,
            cubiertoHasta: estado.cubiertoHasta,
          }
        : null,
      clientes: clientes.map((cliente) => ({
        id: cliente._id as string,
        email: cliente.email,
      })),
    };
  },
});

/**
 * De estos ids, cuáles están ya guardados y cuándo se mandaron.
 *
 * Devuelve también la fecha porque hace falta para bajar el techo de la
 * ventana: un mensaje que se salta por duplicado sigue contando como "mirado",
 * y sin su fecha la ventana no sabría hasta dónde ha llegado.
 */
export const yaGuardados = internalQuery({
  args: { gmailIds: v.array(v.string()) },
  handler: async (ctx, { gmailIds }) => {
    const conocidos: Record<string, number> = {};

    for (const gmailId of gmailIds) {
      const fila = await ctx.db
        .query("correos")
        .withIndex("by_gmail", (q) => q.eq("gmailId", gmailId))
        .first();
      if (fila !== null) conocidos[gmailId] = fila.recibidoEn;
    }

    return conocidos;
  },
});

export const guardarLote = internalMutation({
  args: {
    correos: v.array(
      v.object({
        clienteId: v.id("clientes"),
        gmailId: v.string(),
        hiloId: v.string(),
        direccion: direccionCorreo,
        contraparte: v.string(),
        asunto: v.string(),
        fragmento: v.string(),
        fecha: v.string(),
        recibidoEn: v.number(),
      }),
    ),
  },
  handler: async (ctx, { correos }) => {
    let guardados = 0;

    for (const correo of correos) {
      // Esta es la comprobación que cuenta, y por eso está aquí dentro: la
      // acción que llama no es transaccional, y dos pasadas que se solapen
      // insertarían el mismo correo dos veces.
      const existe = await ctx.db
        .query("correos")
        .withIndex("by_gmail", (q) => q.eq("gmailId", correo.gmailId))
        .first();
      if (existe !== null) continue;

      await ctx.db.insert("correos", correo);
      guardados += 1;
    }

    return guardados;
  },
});

export const cerrarPasada = internalMutation({
  args: {
    buzon: v.string(),
    ventana: v.object({
      desdeEpoch: v.number(),
      hastaEpoch: v.number(),
      cubiertoHasta: v.number(),
    }),
    descartados: v.object({
      sinFicha: v.number(),
      ambiguos: v.number(),
      variosClientes: v.number(),
    }),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { buzon, ventana, descartados, error }) => {
    const estado = await ctx.db
      .query("sincronizacionCorreo")
      .withIndex("buzon", (q) => q.eq("buzon", buzon))
      .unique();

    const campos = {
      buzon,
      ...ventana,
      ultimaPasada: Date.now(),
      // Los descartes se acumulan. Lo que se quiere saber mirando esto es si
      // hay fichas que arreglar, y el recuento de una pasada suelta no lo dice.
      descartados: {
        sinFicha: (estado?.descartados.sinFicha ?? 0) + descartados.sinFicha,
        ambiguos: (estado?.descartados.ambiguos ?? 0) + descartados.ambiguos,
        variosClientes:
          (estado?.descartados.variosClientes ?? 0) + descartados.variosClientes,
      },
      // Sin `error`, el campo se va: una pasada buena borra el fallo anterior.
      ultimoError: error,
    };

    if (estado === null) {
      await ctx.db.insert("sincronizacionCorreo", campos);
    } else {
      await ctx.db.patch(estado._id, campos);
    }
  },
});

/**
 * Una pasada de lectura. La llama el cron cada quince minutos.
 *
 * **No lanza nunca**, ni cuando Google falla: es un trabajo de fondo y lo único
 * que se consigue reventando es que el cron se apague. El motivo queda en
 * `sincronizacionCorreo.ultimoError` y la ventana se guarda **sin avanzar**,
 * así que la pasada siguiente reintenta exactamente lo mismo.
 */
export const sincronizar = internalAction({
  args: {},
  handler: async (ctx) => {
    const cred = credenciales();
    if (cred === null) {
      console.warn("Lectura del buzón apagada: faltan las variables de Gmail");
      return;
    }

    const datos = await ctx.runQuery(internal.correos.datosDeLaPasada, {
      buzon: cred.buzon,
    });

    const ventana = datos.ventana ?? ventanaInicial(Date.now());
    const clientes = mapaDeClientes(datos.clientes);
    const descartados = { sinFicha: 0, ambiguos: 0, variosClientes: 0 };

    let masAntiguoVistoMs: number | null = null;
    const mirar = (ms: number) => {
      if (ms <= 0) return;
      masAntiguoVistoMs =
        masAntiguoVistoMs === null ? ms : Math.min(masAntiguoVistoMs, ms);
    };

    try {
      const token = await tokenDeAcceso(cred);
      const consulta = encodeURIComponent(consultaGmail(ventana));

      let pagina: string | undefined;
      let paginas = 0;
      let agotado = true;

      do {
        const listado: ListadoGmail = await pedirAGmail(
          `/messages?maxResults=100&q=${consulta}` +
            (pagina === undefined ? "" : `&pageToken=${pagina}`),
          token,
        );

        const ids = (listado.messages ?? []).map((mensaje) => mensaje.id);
        const conocidos = await ctx.runQuery(internal.correos.yaGuardados, {
          gmailIds: ids,
        });
        for (const cuando of Object.values(conocidos)) mirar(cuando);

        const nuevos = ids.filter((id) => conocidos[id] === undefined);
        const aGuardar: CorreoNuevo[] = [];

        for (let desde = 0; desde < nuevos.length; desde += EN_PARALELO) {
          const mensajes: MensajeGmail[] = await Promise.all(
            nuevos
              .slice(desde, desde + EN_PARALELO)
              .map((id) =>
                pedirAGmail<MensajeGmail>(
                  `/messages/${id}?format=metadata${CABECERAS}`,
                  token,
                ),
              ),
          );

          for (const mensaje of mensajes) {
            mirar(Number(mensaje.internalDate ?? 0));

            const clasificacion = clasificar(mensaje, clientes);

            if (!clasificacion.guardar) {
              descartados[clasificacion.motivo] += 1;
              if (clasificacion.motivo === "ambiguos") {
                // Los ids de las fichas, que es lo que hace falta para
                // arreglarlo. Ni la dirección ni el asunto ni el fragmento: un
                // id no dice nada fuera del CRM.
                console.warn(
                  `Correo sin asociar: estas fichas comparten el mismo email ` +
                    `(${clasificacion.fichas.join(", ")})`,
                );
              }
              continue;
            }

            aGuardar.push({
              // El id sale de `datosDeLaPasada`, o sea de la propia base. El
              // tipo se pierde al pasar por `lib/correo.ts`, que no conoce
              // Convex a propósito, y se recupera aquí.
              clienteId: clasificacion.clienteId as Id<"clientes">,
              gmailId: mensaje.id,
              hiloId: clasificacion.hiloId,
              direccion: clasificacion.direccion,
              contraparte: clasificacion.contraparte,
              asunto: clasificacion.asunto,
              fragmento: clasificacion.fragmento,
              fecha: hoy(clasificacion.recibidoEn),
              recibidoEn: clasificacion.recibidoEn,
            });
          }
        }

        if (aGuardar.length > 0) {
          await ctx.runMutation(internal.correos.guardarLote, {
            correos: aGuardar,
          });
        }

        paginas += 1;
        pagina = listado.nextPageToken;

        if (pagina !== undefined && paginas >= PAGINAS_POR_PASADA) {
          agotado = false;
          break;
        }
      } while (pagina !== undefined);

      await ctx.runMutation(internal.correos.cerrarPasada, {
        buzon: cred.buzon,
        ventana: siguienteVentana(
          ventana,
          { agotado, masAntiguoVistoMs },
          Date.now(),
        ),
        descartados,
      });
    } catch (error) {
      const motivo =
        error instanceof Error ? error.message : "fallo desconocido";
      console.error(`La lectura del buzón falló: ${motivo}`);

      await ctx.runMutation(internal.correos.cerrarPasada, {
        buzon: cred.buzon,
        ventana,
        descartados,
        error: motivo,
      });
    }
  },
});
