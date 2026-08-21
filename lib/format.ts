/**
 * Formateadores compartidos — implementa parte de JES-45.
 * Son los únicos que deben usar las pantallas: si cada una formatea a su manera,
 * la aplicación deja de verse como un solo producto.
 */

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Fecha de hoy en YYYY-MM-DD, según el reloj del dispositivo. */
export function hoy(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Suma días a una fecha YYYY-MM-DD. Útil para el "dentro de 4 días" por defecto. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
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
  const d = new Date(`${fecha}T00:00:00`);
  const texto = d.toLocaleDateString("es-ES", {
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
