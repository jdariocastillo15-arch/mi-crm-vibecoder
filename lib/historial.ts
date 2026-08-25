import type { CanalInteraccion, EstadoVenta } from "./constants";
import { CANAL_INTERACCION } from "./constants";

/**
 * La línea de tiempo de un cliente — implementa JES-64.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 959–971
 * (cómo se normaliza cada tipo) y 1044–1047 (la mezcla y el orden).
 *
 * Tres cosas que pasan en momentos distintos —lo que se habló, lo que se vendió
 * y lo que se hizo— contadas como una sola historia. El diseño lo resuelve
 * normalizando los tres a la misma forma antes de ordenarlos, y aquí se hace
 * igual: mezclar tipos distintos dentro del JSX obligaría a que cada rama
 * supiera de las otras dos.
 *
 * Sin JSX y sin tipos de Convex, como `lib/seguimientos.ts`: así esto se puede
 * leer, razonar y cambiar sin una pantalla alrededor.
 */

export type TipoHistorial = "interaccion" | "venta" | "seguimiento";

export type EntradaHistorial = {
  clave: string;
  /** YYYY-MM-DD. Es por la que se ordena, y la que se enseña a la derecha. */
  fecha: string;
  tipo: TipoHistorial;
  titulo: string;
  /** Vacío cuando no hay nada que añadir al título: lo dice ya la etiqueta. */
  detalle: string;
  /** "Registrado por X" · "Responsable: X". Vacío si no se sabe quién. */
  autoria: string;
  /** Solo interacciones: decide el icono. */
  canal?: CanalInteraccion;
  /** Solo ventas: decide la etiqueta, el color del círculo y el del importe. */
  estado?: EstadoVenta;
  /** Solo ventas. */
  importe?: number;
};

/** Lo mínimo que hace falta de cada tabla. Estructural, no `Doc<...>`. */

type Interaccion = {
  _id: string;
  _creationTime: number;
  canal: CanalInteraccion;
  texto: string;
  fecha: string;
  autorNombre: string | null;
};

type Venta = {
  _id: string;
  _creationTime: number;
  concepto: string;
  importe: number;
  estado: EstadoVenta;
  fecha: string;
  autorNombre: string | null;
};

type Seguimiento = {
  _id: string;
  _creationTime: number;
  accion: string;
  vence: string;
  hecho: boolean;
  fechaHecho?: string;
  responsableNombre: string | null;
};

/** Con nombre, la línea; sin nombre, nada. Nunca "Registrado por null". */
function autoriaDe(prefijo: string, nombre: string | null): string {
  return nombre ? `${prefijo}${nombre}` : "";
}

/**
 * Las tres listas en una, de la fecha más reciente a la más antigua.
 *
 * De los seguimientos entran SOLO los completados: los abiertos son trabajo por
 * hacer y viven en su propia tarjeta (JES-61). Y se fechan por `fechaHecho`,
 * que es el día en que pasaron —de eso va esta lista—; `vence` solo se usa si
 * faltara, que puede ocurrir con lo que se cerró antes de que ese campo
 * existiera.
 *
 * Los empates de fecha se rompen por antigüedad del documento, también
 * descendente. Sin ese desempate, dos entradas del mismo día quedan en el orden
 * en que las devuelva la base y la lista puede bailar entre recargas.
 */
export function construirHistorial(
  interacciones: Interaccion[],
  ventas: Venta[],
  seguimientos: Seguimiento[],
): EntradaHistorial[] {
  // Cada entrada viaja emparejada con la antigüedad de su documento, que hace
  // falta para desempatar y no para pintar. Emparejarlas en vez de meter el
  // dato dentro evita que salga en el tipo que ve la pantalla.
  const conCreacion: { entrada: EntradaHistorial; creado: number }[] = [
    ...interacciones.map((i) => ({
      creado: i._creationTime,
      entrada: {
        clave: `interaccion-${i._id}`,
        fecha: i.fecha,
        tipo: "interaccion" as const,
        titulo: CANAL_INTERACCION[i.canal],
        detalle: i.texto,
        autoria: autoriaDe("Registrado por ", i.autorNombre),
        canal: i.canal,
      },
    })),

    ...ventas.map((v) => ({
      creado: v._creationTime,
      entrada: {
        clave: `venta-${v._id}`,
        fecha: v.fecha,
        tipo: "venta" as const,
        titulo: v.concepto,
        // Sin detalle a propósito: lo que hay que saber de una venta lo dicen
        // su etiqueta de estado y su importe, que van en su sitio.
        detalle: "",
        autoria: autoriaDe("Registrado por ", v.autorNombre),
        estado: v.estado,
        importe: v.importe,
      },
    })),

    ...seguimientos
      .filter((s) => s.hecho)
      .map((s) => ({
        creado: s._creationTime,
        entrada: {
          clave: `seguimiento-${s._id}`,
          fecha: s.fechaHecho ?? s.vence,
          tipo: "seguimiento" as const,
          titulo: s.accion,
          detalle: "Seguimiento completado",
          // El RESPONSABLE, no quien lo cerró. Lo piden las dos issues que
          // mandan sobre esta lista: JES-58 ("reaparece en el historial [...]
          // con su responsable") y el criterio de JES-64.
          autoria: autoriaDe("Responsable: ", s.responsableNombre),
        },
      })),
  ];

  return conCreacion
    .sort((a, b) => {
      if (a.entrada.fecha !== b.entrada.fecha) {
        return a.entrada.fecha < b.entrada.fecha ? 1 : -1;
      }
      return b.creado - a.creado;
    })
    .map((c) => c.entrada);
}
