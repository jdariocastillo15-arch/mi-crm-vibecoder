import { normalizar, soloDigitos } from "./format";

/**
 * Buscador de clientes — implementa parte de JES-50.
 *
 * Vive aquí y no en la pantalla porque es la única parte con reglas de verdad:
 * qué campos entran, cómo se comparan y cuándo cuenta el teléfono. Así se puede
 * leer entera de un vistazo, sin JSX alrededor.
 *
 * El filtrado es del cliente a propósito: `clientes.list` devuelve la lista
 * completa y a la escala de este negocio —decenas o pocos cientos— eso es lo que
 * permite filtrar según se escribe, sin ida y vuelta al servidor.
 */

/** Lo mínimo que el filtro necesita saber de un cliente. */
export interface ClienteBuscable {
  nombre: string;
  empresa?: string;
  email?: string;
  telefono?: string;
}

/**
 * Por debajo de dos dígitos el teléfono no filtra.
 *
 * Escribir "6" haría coincidir a casi todo el mundo —cualquier móvil español
 * lleva un 6— y la lista parecería no responder. Es la misma regla del diseño.
 */
const MINIMO_DIGITOS = 2;

export function filtrarClientes<T extends ClienteBuscable>(
  clientes: T[],
  consulta: string,
): T[] {
  const texto = normalizar(consulta.trim());
  if (!texto) return clientes;

  // El teléfono se compara solo por dígitos: así "600112233" encuentra a
  // "+34 600 112 233" sin que importen espacios, guiones ni prefijo.
  const digitos = soloDigitos(texto);
  const cuentaTelefono = digitos.length >= MINIMO_DIGITOS;

  return clientes.filter(
    (c) =>
      normalizar(c.nombre).includes(texto) ||
      normalizar(c.empresa ?? "").includes(texto) ||
      normalizar(c.email ?? "").includes(texto) ||
      (cuentaTelefono && soloDigitos(c.telefono ?? "").includes(digitos)),
  );
}

/**
 * El texto del contador: "2 clientes" o "1 resultado".
 *
 * Va en minúsculas porque quien lo pone en mayúsculas es el CSS, igual que en
 * el diseño. Con una sola cifra basta: sin búsqueda, los mostrados SON todos.
 *
 * El prototipo solo pone en singular "resultado" y deja escrito "1 clientes".
 * La issue pide el singular sin distinguir cuál de los dos, así que aquí se
 * corrigen los dos.
 */
export function textoContador(mostrados: number, hayConsulta: boolean): string {
  if (hayConsulta) {
    return `${mostrados} ${mostrados === 1 ? "resultado" : "resultados"}`;
  }
  return `${mostrados} ${mostrados === 1 ? "cliente" : "clientes"}`;
}
