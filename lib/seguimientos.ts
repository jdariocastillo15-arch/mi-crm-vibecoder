import { diasDeRetraso, hoy, fechaCorta } from "./format";

/**
 * Clasificación de seguimientos — implementa JES-55.
 * Misma regla que `convex/seguimientos.ts#clasificar`: si cambias una, cambia la otra.
 */

export type Seccion = "atrasado" | "hoy" | "proxima";

export function clasificar(vence: string, referencia: string = hoy()): Seccion {
  const dias = diasDeRetraso(vence, referencia);
  if (dias > 0) return "atrasado";
  if (dias === 0) return "hoy";
  return "proxima";
}

/** El subtítulo de vencimiento, con los textos exactos del diseño. */
export function textoVencimiento(vence: string, referencia: string = hoy()): string {
  const dias = diasDeRetraso(vence, referencia);
  if (dias === 1) return "Venció ayer";
  if (dias > 1) return `Venció hace ${dias} días`;
  if (dias === 0) return "Vence hoy";
  return `Vence el ${fechaCorta(vence)}`;
}

/**
 * Los no completados, del vencimiento más próximo al más lejano.
 *
 * Lo usan las dos vistas de lo mismo: "Hoy", que agrupa por día a todo el
 * mundo, y la tarjeta de la ficha, que lo mira por cliente (JES-61). Con una
 * sola definición no pueden discrepar sobre qué cuenta como pendiente.
 */
export function pendientesPorVencimiento<T extends { vence: string; hecho: boolean }>(
  seguimientos: T[],
): T[] {
  return seguimientos
    .filter((s) => !s.hecho)
    .sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0));
}

/**
 * Agrupa los pendientes en las tres secciones de "Hoy".
 * Los atrasados van de más antiguo a más reciente; el resto, por fecha ascendente.
 */
export function agruparParaHoy<T extends { vence: string; hecho: boolean }>(
  seguimientos: T[],
  referencia: string = hoy(),
) {
  const pendientes = pendientesPorVencimiento(seguimientos);

  const atrasados = pendientes.filter((s) => clasificar(s.vence, referencia) === "atrasado");
  const paraHoy = pendientes.filter((s) => clasificar(s.vence, referencia) === "hoy");
  const proximas = pendientes.filter((s) => clasificar(s.vence, referencia) === "proxima");

  return {
    atrasados,
    paraHoy,
    proximas,
    /** El titular cuenta SOLO atrasados y de hoy. Las próximas no suman. */
    totalHoy: atrasados.length + paraHoy.length,
  };
}
