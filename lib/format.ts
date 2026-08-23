/**
 * Formateadores compartidos — implementa parte de JES-45.
 * Son los únicos que deben usar las pantallas: si cada una formatea a su manera,
 * la aplicación deja de verse como un solo producto.
 */

/**
 * El día de negocio es uno solo, y es este.
 *
 * Un seguimiento vence "el día 27", no "el 27 a las 00:00 de una zona horaria".
 * Si cliente y servidor calculan "hoy" con relojes distintos, la misma tarea
 * cae en secciones distintas según quién la mire — y entre las 00:00 y las
 * 02:00 en Madrid eso pasaba de verdad, porque el servidor iba en UTC.
 *
 * Existe la misma constante en `convex/helpers.ts`: si cambias una, cambia la
 * otra.
 */
export const ZONA_NEGOCIO = "Europe/Madrid";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** La fecha de calendario de un instante, en la zona de negocio. */
function fechaEnZona(instante: Date): string {
  // `formatToParts` en vez de leer la cadena que devuelve el locale: así no
  // dependemos de que "en-CA" siga escribiendo YYYY-MM-DD el día de mañana.
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instante);

  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

/** Fecha de hoy en YYYY-MM-DD, según el día de negocio. */
export function hoy(): string {
  return fechaEnZona(new Date());
}

/**
 * ¿Existe esa fecha de verdad?
 *
 * El formato no basta: "2026-02-30" y "2026-99-99" pasan cualquier regex, y
 * luego `Date.parse` devuelve NaN, `diasDeRetraso` devuelve NaN, y como NaN no
 * es mayor ni igual a cero la fecha acaba clasificada como "próxima" con el
 * texto "Vence el 30 undefined". Se comprueba construyendo la fecha y mirando
 * si los componentes sobreviven al viaje.
 *
 * Existe la misma función en `convex/helpers.ts`: si cambias una, cambia la otra.
 */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;

  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/** Suma días a una fecha YYYY-MM-DD. Útil para el "dentro de 4 días" por defecto. */
export function sumarDias(fecha: string, dias: number): string {
  // Aritmética en UTC de punta a punta. Mezclar medianoche local con
  // `toISOString` restaba un día en cualquier huso por delante de UTC.
  const base = Date.parse(`${fecha}T00:00:00Z`);
  return new Date(base + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Días que lleva vencida una fecha. Positivo = atrasada, 0 = hoy, negativo = futura. */
export function diasDeRetraso(fecha: string, referencia: string = hoy()): number {
  const a = Date.parse(`${referencia}T00:00:00Z`);
  const b = Date.parse(`${fecha}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/** Euros enteros con punto de millar: 12400 → "€12.400" */
export function formatEuros(importe: number): string {
  const entero = Math.round(Number(importe) || 0);
  return `€${entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** "Hoy" · "Ayer" · "Hace 3 días" · "Hace 2 semanas" */
export function fechaRelativa(fecha: string, referencia: string = hoy()): string {
  const dias = diasDeRetraso(fecha, referencia);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  const semanas = Math.round(dias / 7);
  return `Hace ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
}

/** "2026-06-23" → "23 jun" */
export function fechaCorta(fecha: string): string {
  const partes = fecha.split("-");
  if (partes.length !== 3) return fecha;
  return `${parseInt(partes[2], 10)} ${MESES[parseInt(partes[1], 10) - 1]}`;
}

/** "Martes, 23 de junio" — la cabecera de la pantalla Hoy. */
export function fechaLarga(fecha: string = hoy()): string {
  // Instante en UTC y formateo fijado a la zona de negocio: antes las dos
  // mitades usaban el huso del entorno y se cancelaban, así que salía bien por
  // accidente. Ahora sale bien por escrito.
  const d = new Date(`${fecha}T00:00:00Z`);
  const texto = d.toLocaleDateString("es-ES", {
    timeZone: ZONA_NEGOCIO,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Iniciales para el avatar: "Marta López" → "ML" */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Solo los dígitos, para comparar teléfonos ignorando espacios y prefijos. */
export function soloDigitos(texto: string): string {
  return (texto ?? "").replace(/[^0-9]/g, "");
}

export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
