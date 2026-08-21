import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Vibe CRM — modelo de datos.
 *
 * Fuente de verdad: Notion → "CRM - PRD", sección "Datos".
 * Las cinco entidades del MVP: Usuario, Cliente, Seguimiento, Interacción y Venta.
 *
 * Dos decisiones importantes, tomadas contra las "trampas del prototipo" que
 * documenta el PRD:
 *
 * 1. Las fechas de calendario (vencimiento de un seguimiento, fecha de una
 *    interacción o de una venta) se guardan como texto `YYYY-MM-DD`, no como
 *    marca de tiempo. Un seguimiento vence "el día 27", no "el 27 a las 00:00
 *    de una zona horaria concreta": guardarlo como fecha evita que cambie de
 *    sección según dónde esté el usuario.
 * 2. La autoría se guarda por **referencia al usuario** (`Id<"users">`), nunca
 *    por su nombre. Si alguien cambia su nombre en "Mi cuenta", su historial
 *    tiene que seguir reconociéndole.
 */

/** Los cinco estados de un cliente. Se guardan con su nombre de negocio, no con el del color. */
export const estadoCliente = v.union(
  v.literal("nuevo_lead"),
  v.literal("en_negociacion"),
  v.literal("pendiente"),
  v.literal("ganado"),
  v.literal("perdido"),
);

/** Por dónde llegó el cliente. Opcional y deseleccionable. */
export const canalOrigen = v.union(
  v.literal("web"),
  v.literal("redes"),
  v.literal("email"),
  v.literal("whatsapp"),
);

/** Por dónde se habló con el cliente esta vez. Ojo: "en_persona", no "redes". */
export const canalInteraccion = v.union(
  v.literal("llamada"),
  v.literal("email"),
  v.literal("whatsapp"),
  v.literal("en_persona"),
);

/** Estado de una venta u oportunidad. */
export const estadoVenta = v.union(
  v.literal("abierta"),
  v.literal("ganada"),
  v.literal("perdida"),
);

/** Rol del usuario. Solo decide una cosa: si la pantalla de Equipo existe. */
export const rolUsuario = v.union(
  v.literal("propietaria"),
  v.literal("comercial"),
);

export default defineSchema({
  ...authTables,

  /**
   * Usuarios del sistema. Extiende la tabla que necesita Convex Auth con el rol.
   * Los campos de Convex Auth y el índice "email" son obligatorios: no quitarlos.
   */
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    // ---- Campo propio de Vibe CRM ----
    rol: v.optional(rolUsuario),
  }).index("email", ["email"]),

  clientes: defineTable({
    nombre: v.string(),
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    canal: v.optional(canalOrigen),
    estado: estadoCliente,
    nota: v.optional(v.string()),
    /** YYYY-MM-DD. Se pone sola al crear el cliente. */
    fechaAlta: v.string(),
    /** YYYY-MM-DD. Se deriva de las interacciones; nunca se edita a mano. */
    ultimoContacto: v.string(),
  })
    .index("by_estado", ["estado"])
    .index("by_ultimo_contacto", ["ultimoContacto"]),

  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    accion: v.string(),
    /** YYYY-MM-DD. Decide en qué sección de "Hoy" aparece. */
    vence: v.string(),
    hecho: v.boolean(),
    /** YYYY-MM-DD. Se pone al completarlo y se borra al deshacer. */
    fechaHecho: v.optional(v.string()),
    responsableId: v.id("users"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_hecho_vence", ["hecho", "vence"])
    .index("by_responsable", ["responsableId"]),

  interacciones: defineTable({
    clienteId: v.id("clientes"),
    canal: canalInteraccion,
    texto: v.string(),
    /** YYYY-MM-DD */
    fecha: v.string(),
    autorId: v.id("users"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_cliente_fecha", ["clienteId", "fecha"]),

  ventas: defineTable({
    clienteId: v.id("clientes"),
    /** Texto libre. NO es un producto de catálogo: el catálogo está fuera del MVP. */
    concepto: v.string(),
    /** Euros, entero, mayor que cero. */
    importe: v.number(),
    estado: estadoVenta,
    /** YYYY-MM-DD */
    fecha: v.string(),
    autorId: v.id("users"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_estado", ["estado"]),
});
