/**
 * Vocabulario de la interfaz. Los textos son los del diseño, literales.
 * Fuente: Notion → "CRM - PRD" y DESING/design_handoff_crm_pwa/CRM Shell.dc.html
 */

export type EstadoCliente =
  | "nuevo_lead"
  | "en_negociacion"
  | "pendiente"
  | "ganado"
  | "perdido";

export type CanalOrigen = "web" | "redes" | "email" | "whatsapp";
export type CanalInteraccion = "llamada" | "email" | "whatsapp" | "en_persona";
export type EstadoVenta = "abierta" | "ganada" | "perdida";
export type RolUsuario = "propietaria" | "comercial";

/** Tono de color semántico. Es presentación: no guardar esto en la base de datos. */
export type Tono = "success" | "warning" | "error" | "info" | "primary" | "neutral";

export const ESTADO_CLIENTE: Record<EstadoCliente, { label: string; tono: Tono }> = {
  nuevo_lead: { label: "Nuevo lead", tono: "info" },
  en_negociacion: { label: "En negociación", tono: "primary" },
  pendiente: { label: "Pendiente", tono: "warning" },
  ganado: { label: "Ganado", tono: "success" },
  perdido: { label: "Perdido", tono: "error" },
};

export const CANAL_ORIGEN: Record<CanalOrigen, string> = {
  web: "Web",
  redes: "Redes",
  email: "Email",
  whatsapp: "WhatsApp",
};

/** Ojo: "En persona", no "Redes". El canal de origen sí mantiene "Redes". */
export const CANAL_INTERACCION: Record<CanalInteraccion, string> = {
  llamada: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  en_persona: "En persona",
};

export const ESTADO_VENTA: Record<EstadoVenta, { label: string; tono: Tono }> = {
  abierta: { label: "Oportunidad abierta", tono: "info" },
  ganada: { label: "Ganada", tono: "success" },
  perdida: { label: "Perdida", tono: "error" },
};

/**
 * El rótulo bajo el nombre, en la barra lateral (`AppShell.tsx:91`). Solo caben
 * 94 px —el aside son 240 y se los reparten el padding, el avatar, el botón de
 * salir y las separaciones— y ese span no lleva `truncate`: lo que se pasa no
 * se corta con puntos suspensivos, parte en dos líneas y descoloca el pie de la
 * barra. Con Inter 12/16 son unos 15 caracteres; «Atiende y vende» ya gasta
 * 89,3 px. Si alargas un rótulo, mídelo antes.
 */
export const ROL: Record<RolUsuario, string> = {
  propietaria: "Lleva el equipo",
  comercial: "Atiende y vende",
};

/** Mensajes de los avisos, exactamente como están en el diseño. */
export const AVISOS = {
  clienteAnadido: "Cliente añadido",
  tareaCreada: "Tarea creada",
  interaccionRegistrada: "Interacción registrada",
  ventaRegistrada: "Venta registrada",
  seguimientoProgramado: "Seguimiento programado",
  seguimientoCompletado: "Seguimiento completado",
  usuarioAnadido: "Usuario añadido",
  usuarioActualizado: "Usuario actualizado",
  usuarioEliminado: "Usuario eliminado",
  datosActualizados: "Datos actualizados",
  contrasenaActualizada: "Contraseña actualizada",
} as const;

/** El corte entre las dos disposiciones. Coincide con `md` de Tailwind. */
export const BREAKPOINT_DESKTOP = 768;
