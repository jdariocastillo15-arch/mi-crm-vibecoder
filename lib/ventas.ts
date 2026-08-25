import type { EstadoVenta } from "./constants";

/**
 * Reglas de la pantalla "Ventas" — implementa JES-66 y JES-67.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 1252–1278
 * (orden, sumas, contadores y mensajes vacíos).
 *
 * Todo sale de la MISMA lista de ventas: las dos cifras de cabecera, los cuatro
 * contadores del filtro y las filas del listado. No es un detalle de eficiencia
 * —a la escala de este negocio da igual—, es que un criterio de JES-66 pide que
 * los contadores cuadren con las operaciones, y eso solo se puede garantizar si
 * nadie los calcula por su cuenta.
 *
 * Sin JSX y sin tipos de Convex, como `lib/clientes.ts` y `lib/seguimientos.ts`.
 */

/** Los cuatro filtros de la pantalla. "todas" no es un estado de la base. */
export type FiltroVenta = "todas" | EstadoVenta;

/** Los cuatro botones, en el orden del diseño. El contador lo pone la pantalla. */
export const FILTROS_VENTA: { valor: FiltroVenta; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "abierta", etiqueta: "En marcha" },
  { valor: "ganada", etiqueta: "Ganadas" },
  { valor: "perdida", etiqueta: "Perdidas" },
];

/** El título del estado vacío depende del filtro: la ayuda es la misma en los cuatro. */
export const VACIO_POR_FILTRO: Record<FiltroVenta, string> = {
  todas: "Sin ventas registradas",
  abierta: "Sin oportunidades abiertas",
  ganada: "Sin ventas ganadas",
  perdida: "Sin ventas perdidas",
};

/**
 * Colores del círculo del icono y del importe, por estado.
 *
 * Viven aquí y no dentro de una pantalla porque los usan DOS: el listado de
 * ventas y el historial de la ficha (JES-64). Mientras hubo un solo dueño
 * estaban bien en su componente —es lo que hacen `Badge` y `Chips`—, pero dos
 * copias de un mapa de colores se desvían en cuanto alguien retoca una.
 *
 * Escritos enteros: Tailwind busca las clases leyendo el texto del fichero, así
 * que un `bg-${estado}-bg` no llegaría a existir en la hoja de estilos.
 *
 * Ojo al importe de una oportunidad abierta: va en color de TEXTO normal, no en
 * el azul de su etiqueta. Lo dice el diseño (`VENTA_EST.amt`) y tiene sentido —
 * lo que sigue abierto todavía no es ni bueno ni malo, y teñirlo lo contaría
 * como un resultado.
 */
export const CIRCULO_VENTA: Record<EstadoVenta, string> = {
  abierta: "bg-info-bg text-info",
  ganada: "bg-success-bg text-success",
  perdida: "bg-error-bg text-error",
};

export const IMPORTE_VENTA: Record<EstadoVenta, string> = {
  abierta: "text-text",
  ganada: "text-success-text",
  perdida: "text-error-text",
};

/** A igual fecha: primero lo que sigue vivo, luego lo ganado, al final lo perdido. */
const ORDEN_ESTADO: Record<EstadoVenta, number> = {
  abierta: 0,
  ganada: 1,
  perdida: 2,
};

export interface ResumenVentas {
  /** Suma de las abiertas. Las perdidas no entran. */
  enMarcha: number;
  /** Suma de las ganadas. Las perdidas no entran. */
  ganado: number;
  conteo: Record<FiltroVenta, number>;
}

/**
 * Las dos cifras de cabecera y los cuatro contadores del filtro.
 *
 * Las perdidas cuentan en su contador pero NO suman en ninguna de las dos
 * cifras: "En marcha" y "Ganado" son dinero que sigue en juego o que ya entró,
 * y una venta perdida no es ninguna de las dos cosas.
 */
export function resumenVentas<T extends { estado: EstadoVenta; importe: number }>(
  ventas: T[],
): ResumenVentas {
  const sumaDe = (estado: EstadoVenta) =>
    ventas.reduce((total, v) => (v.estado === estado ? total + v.importe : total), 0);

  const cuantas = (estado: EstadoVenta) =>
    ventas.reduce((total, v) => (v.estado === estado ? total + 1 : total), 0);

  return {
    enMarcha: sumaDe("abierta"),
    ganado: sumaDe("ganada"),
    conteo: {
      todas: ventas.length,
      abierta: cuantas("abierta"),
      ganada: cuantas("ganada"),
      perdida: cuantas("perdida"),
    },
  };
}

/**
 * De la más reciente a la más antigua.
 *
 * Tres niveles de desempate, y el tercero no lo pide la issue: a igual fecha y
 * estado se ordena por antigüedad del documento, porque sin eso dos ventas del
 * mismo día quedan en el orden en que las devuelva la base y la lista baila
 * entre recargas. Es la misma lección que dejó el historial de JES-64.
 *
 * Copia antes de ordenar: `sort` muta, y el array que llega es el de la caché
 * de Convex.
 */
export function ordenarVentas<
  T extends { fecha: string; estado: EstadoVenta; _creationTime: number },
>(ventas: T[]): T[] {
  return [...ventas].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.estado !== b.estado) return ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
    return b._creationTime - a._creationTime;
  });
}

export function filtrarVentas<T extends { estado: EstadoVenta }>(
  ventas: T[],
  filtro: FiltroVenta,
): T[] {
  return filtro === "todas" ? ventas : ventas.filter((v) => v.estado === filtro);
}

/** "1 oportunidad" · "3 oportunidades" */
export function textoOportunidades(cuantas: number): string {
  return `${cuantas} ${cuantas === 1 ? "oportunidad" : "oportunidades"}`;
}

/** "1 venta cerrada" · "2 ventas cerradas" */
export function textoVentasCerradas(cuantas: number): string {
  return `${cuantas} ${cuantas === 1 ? "venta cerrada" : "ventas cerradas"}`;
}
