/**
 * Las decisiones de la lectura del buzón — implementa parte de JES-103.
 *
 * Qué ventana de tiempo se le pide a Gmail y qué se hace con cada mensaje.
 * Funciones puras y sin tipos de Convex, como `lib/historial.ts` y
 * `lib/seguimientos.ts`: así los casos difíciles se provocan con respuestas
 * inventadas, sin buzón y sin base de datos. Los cuatro hallazgos de auditoría
 * —M1 a M4— se comprueban aquí.
 *
 * `convex/correos.ts` solo orquesta: pide, llama a esto y guarda.
 */

/** Lo que devuelve Gmail en `messages.get` con `format=metadata`. */
export type MensajeGmail = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  /** Milisegundos desde epoch, en texto. Así lo manda Gmail. */
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

/** Lo que devuelve `messages.list`. */
export type ListadoGmail = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
};

export type DireccionCorreo = "entrante" | "saliente";

/** Por qué un correo no se guarda. Son los contadores de la tabla de estado. */
export type MotivoDescarte = "sinFicha" | "ambiguos" | "variosClientes";

export type Clasificacion =
  | {
      guardar: true;
      clienteId: string;
      direccion: DireccionCorreo;
      contraparte: string;
      asunto: string;
      fragmento: string;
      hiloId: string;
      /** Milisegundos. La fecha de negocio la pone quien guarda. */
      recibidoEn: number;
    }
  | {
      guardar: false;
      motivo: MotivoDescarte;
      /** Las fichas en conflicto, para poder arreglarlas. Nunca la dirección. */
      fichas: string[];
    };

/**
 * Forma canónica de un email.
 *
 * Existe la misma función en `convex/helpers.ts#normalizaEmail`: si cambias
 * una, cambia la otra. Se duplica por lo mismo que `hoy` y `esFechaValida`:
 * `convex/` no importa de `lib/`.
 */
export function normalizaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * El `snippet` de Gmail, legible.
 *
 * Viene con las entidades HTML escapadas: un correo que citaba
 * `<soport@vibe-crm-pro.net>` llega como `&lt;soport@vibe-crm-pro.net&gt;`, y en
 * la ficha se lee tal cual. Visto en la prueba real del 2026-09-18.
 *
 * Se deshacen las cinco que escapa Gmail, y `&amp;` la última: si fuera la
 * primera, un `&amp;lt;` literal acabaría convertido en `<`.
 */
export function textoDeGmail(valor: string): string {
  return valor
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Las direcciones de una cabecera `From`, `To` o `Cc`.
 *
 * Vienen como `Nombre <a@b.com>, c@d.com`. Partir por comas basta: un nombre
 * con coma va entre comillas, y el trozo que queda suelto no tiene arroba, así
 * que el filtro final lo tira. De cada trozo solo interesa lo de dentro de los
 * ángulos, si los hay.
 */
export function direccionesDe(valor: string | undefined): string[] {
  if (!valor) return [];

  return valor
    .split(",")
    .map((trozo) => {
      const angulos = trozo.match(/<([^>]+)>/);
      return normalizaEmail(angulos ? angulos[1] : trozo);
    })
    .filter((direccion) => direccion.includes("@"));
}

/**
 * Email normalizado → las fichas que lo tienen. En plural a propósito.
 *
 * `clientes.crear` no impide que dos fichas compartan email, y guarda el correo
 * con `trim()` pero sin pasarlo a minúsculas (`convex/clientes.ts:46`). Por eso
 * esto es un mapa en memoria y no un índice: un índice distinguiría mayúsculas.
 * Es la misma trampa que ya documenta `helpers.ts#buscarUsuarioPorEmail`.
 */
export function mapaDeClientes(
  clientes: { id: string; email?: string }[],
): Map<string, string[]> {
  const mapa = new Map<string, string[]>();

  for (const cliente of clientes) {
    const email = normalizaEmail(cliente.email ?? "");
    if (email.length === 0) continue;

    const fichas = mapa.get(email);
    if (fichas) fichas.push(cliente.id);
    else mapa.set(email, [cliente.id]);
  }

  return mapa;
}

/**
 * De quién es este correo y si se guarda.
 *
 * **La dirección la decide el propio buzón, no los destinatarios** (M3). La
 * etiqueta `SENT` es la única autoridad sobre lo que salió de él; mirarla es
 * más fiable que comparar el `From` con la dirección del buzón, porque no se
 * rompe con los alias de envío.
 *
 * **No se exige `INBOX`** (M4): archivar una conversación le quita esa etiqueta
 * y la deja sin ninguna de las dos, y archivar es de lo más corriente. Exigirla
 * dejaba fuera correos buenos, y encima sin avisar.
 *
 * Y el emparejado **falla cerrado** (M2): si la dirección corresponde a varias
 * fichas, o si el correo toca a dos clientes distintos, no se elige ninguno.
 * Elegir "la primera que aparezca" es escribir una asociación inventada en el
 * historial de alguien.
 */
export function clasificar(
  mensaje: MensajeGmail,
  clientes: Map<string, string[]>,
): Clasificacion {
  const cabecera = (nombre: string) =>
    mensaje.payload?.headers?.find((h) => h.name.toLowerCase() === nombre)
      ?.value;

  const saliente = (mensaje.labelIds ?? []).includes("SENT");

  // Si salió del buzón, el cliente está entre los destinatarios. Si no —lo
  // recibiera o esté archivado—, el cliente es quien lo manda. Un tercero
  // desconocido que copie a un cliente no convierte esto en un saliente: su
  // `From` no es de nadie y el correo se descarta más abajo.
  const posibles = saliente
    ? [...direccionesDe(cabecera("to")), ...direccionesDe(cabecera("cc"))]
    : direccionesDe(cabecera("from"));

  const conFicha = posibles
    .map((direccion) => ({ direccion, fichas: clientes.get(direccion) ?? [] }))
    .filter((posible) => posible.fichas.length > 0);

  if (conFicha.length === 0) {
    return { guardar: false, motivo: "sinFicha", fichas: [] };
  }

  // Dos clientes distintos en el mismo correo: el modelo es de una fila por
  // correo y el dedupe va por el id de Gmail, así que no hay forma de
  // representarlo. Queda como follow-up.
  const distintas = [...new Set(conFicha.flatMap((posible) => posible.fichas))];
  if (conFicha.length > 1 && distintas.length > 1) {
    return { guardar: false, motivo: "variosClientes", fichas: distintas };
  }

  const [coincidencia] = conFicha;
  if (coincidencia.fichas.length > 1) {
    return { guardar: false, motivo: "ambiguos", fichas: coincidencia.fichas };
  }

  return {
    guardar: true,
    clienteId: coincidencia.fichas[0],
    direccion: saliente ? "saliente" : "entrante",
    contraparte: coincidencia.direccion,
    asunto: (cabecera("subject") ?? "").trim(),
    fragmento: textoDeGmail(mensaje.snippet ?? ""),
    hiloId: mensaje.threadId,
    // Gmail siempre manda `internalDate` en un mensaje de verdad; el cero solo
    // está para que el tipo sea honesto.
    recibidoEn: Number(mensaje.internalDate ?? 0),
  };
}

// ---------------------------------------------------------------------------
// La ventana de tiempo — el arreglo de M1.
//
// `messages.list` devuelve de lo más nuevo a lo más viejo y no admite
// invertirlo. Por eso una ventana no se consume subiendo su suelo, sino
// BAJANDO SU TECHO: lo que queda por leer está siempre por debajo de lo leído,
// y adelantar el suelo con lo procesado en una pasada parcial se saltaba en
// silencio todo lo anterior.
// ---------------------------------------------------------------------------

export type Ventana = {
  /** Segundos. Suelo de lo que queda por leer. Solo sube al cerrar la ventana. */
  desdeEpoch: number;
  /** Segundos. Techo de lo que queda por leer. Baja en cada pasada parcial. */
  hastaEpoch: number;
  /** Segundos. El techo con el que se abrió: por encima ya está todo leído. */
  cubiertoHasta: number;
};

/** Diez minutos. Lo que se repite al abrir ventana, para no perder el borde. */
export const SOLAPE_SEGUNDOS = 10 * 60;

/** Lo que trae la primera carga, por decisión del dueño. */
export const DIAS_INICIALES = 30;

export function ventanaInicial(ahoraMs: number): Ventana {
  const ahora = Math.floor(ahoraMs / 1000);
  return {
    desdeEpoch: ahora - DIAS_INICIALES * 24 * 60 * 60,
    hastaEpoch: ahora,
    cubiertoHasta: ahora,
  };
}

export function consultaGmail(ventana: Ventana): string {
  return `after:${ventana.desdeEpoch} before:${ventana.hastaEpoch} -in:chats -in:drafts`;
}

export type AvanceVentana = {
  ventana: Ventana;
  /**
   * La ventana no ha podido avanzar: en un mismo segundo hay más mensajes de
   * los que caben en el presupuesto de páginas. No se toca nada, y quien llama
   * lo registra como error.
   */
  atascada: boolean;
};

/**
 * Dónde se queda la lectura después de una pasada.
 *
 * - **Se agotó el listado:** la ventana está entera. Se abre otra desde
 *   `cubiertoHasta` —el techo ORIGINAL— menos el solape. Del techo actual no,
 *   que para entonces ya ha bajado: se volvería a recorrer lo recién importado
 *   y la carga inicial no alcanzaría nunca el régimen normal.
 * - **Se acabaron las páginas:** la ventana sigue abierta y baja el techo hasta
 *   el mensaje más antiguo que se ha mirado. El suelo NO se toca.
 * - **No hay avance posible:** se deja la ventana como está y se avisa.
 *
 * Ese último caso es el arreglo de la segunda vuelta de M1. Antes se forzaba el
 * techo un segundo hacia abajo «para que la ventana se cerrara alguna vez», y
 * eso **perdía correo en silencio**: con 501 mensajes en el mismo segundo y un
 * presupuesto de 500, la segunda pasada bajaba el techo por debajo de ese
 * segundo y el que faltaba no se leía nunca, mientras el estado declaraba la
 * ventana completada. Más vale atascarse y decirlo que avanzar dejándose algo.
 */
export function siguienteVentana(
  ventana: Ventana,
  resultado: { agotado: boolean; masAntiguoVistoMs: number | null },
  ahoraMs: number,
): AvanceVentana {
  if (resultado.agotado || resultado.masAntiguoVistoMs === null) {
    const ahora = Math.floor(ahoraMs / 1000);
    return {
      atascada: false,
      ventana: {
        desdeEpoch: ventana.cubiertoHasta - SOLAPE_SEGUNDOS,
        hastaEpoch: ahora,
        cubiertoHasta: ahora,
      },
    };
  }

  // El +1 es para no saltarse a los que comparten ese mismo segundo, que
  // `before:` va por segundos; el dedupe por id de Gmail absorbe la repetición.
  const propuesto = Math.floor(resultado.masAntiguoVistoMs / 1000) + 1;

  // Si el techo propuesto no baja, en ese segundo quedan mensajes por leer.
  if (propuesto >= ventana.hastaEpoch) {
    return { ventana, atascada: true };
  }

  return { ventana: { ...ventana, hastaEpoch: propuesto }, atascada: false };
}
