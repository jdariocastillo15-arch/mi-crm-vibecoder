import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Tareas programadas.
 *
 * De momento solo una: vaciar las reservas de código ya vencidas. Sin ella la
 * tabla `limitesRecuperacion` crecía para siempre, porque la pantalla de acceso
 * escribe una fila por cada correo distinto y nada las borraba. Ver
 * `recuperar.ts#limpiarCaducados`, donde está el porqué de que sea seguro
 * borrarlas.
 *
 * Cada seis horas basta: las filas caducan en una y no molestan mientras están.
 * Y si un día hubiera muchísimas, la propia mutación se encadena sola en vez de
 * esperar a la pasada siguiente.
 */
const crons = cronJobs();

// El identificador va SIN acentos: Convex solo admite ASCII no de control
// (`server/cron.ts#validatedCronIdentifier`) y rechaza el push si no.
crons.interval(
  "limpiar reservas de recuperacion vencidas",
  { hours: 6 },
  internal.recuperar.limpiarCaducados,
  {},
);

// Cada cuarto de hora es suficiente para un historial de cliente, y deja la
// ventana incremental tan pequeña que una pasada normal cabe de sobra en el
// presupuesto de páginas. Ver `correos.sincronizar`: no lanza nunca, así que un
// fallo de Google no apaga esto.
crons.interval(
  "leer el correo del buzon",
  { minutes: 15 },
  internal.correos.sincronizar,
  {},
);

export default crons;
