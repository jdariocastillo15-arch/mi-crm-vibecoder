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

/** Si el buzón de la empresa mandó ese correo o lo recibió. */
export const direccionCorreo = v.union(
  v.literal("entrante"),
  v.literal("saliente"),
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
    // ---- Campos propios de Vibe CRM ----
    rol: v.optional(rolUsuario),
    /**
     * Esta persona tiene credencial de contraseña, pero todavía NO la ha
     * elegido ella: la creó el servidor con un secreto aleatorio para que el
     * flujo de código de JES-87 tuviera una cuenta a la que agarrarse.
     *
     * Hace falta porque la sola existencia de la fila en `authAccounts` no
     * distingue «ya eligió su contraseña» de «todavía no», y de eso depende
     * que el login le pida la contraseña o le mande un código (JES-92).
     *
     * Ausente = la contraseña es suya. Se limpia solo cuando la nueva queda
     * guardada, nunca antes.
     */
    contrasenaPendiente: v.optional(v.boolean()),
    /**
     * Cuándo se dio de baja a esta persona. Ausente = está activa.
     *
     * La baja es LÓGICA y no un borrado, porque `seguimientos.responsableId` e
     * `interacciones.autorId` son referencias obligatorias: borrar la fila las
     * dejaba apuntando a alguien que ya no existe. Conservándola, el historial
     * sigue diciendo quién hizo cada cosa aunque esa persona ya no esté.
     *
     * Lo que sí se le quita es el acceso: sus credenciales se borran, y las
     * puertas de `auth.ts`, `acceso.ts` y `helpers.ts#requireUser` la rechazan.
     *
     * Marca temporal en vez de booleano: dice también *cuándo*, y el valor
     * ausente ya significa «activa» sin migrar las filas que ya existían.
     */
    bajaEn: v.optional(v.number()),
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
    /**
     * Quién lo cerró, que no tiene por qué ser el responsable: en "Hoy" se ven
     * los pendientes de todo el equipo y cualquiera puede tachar lo que ya está
     * hecho. Se guarda para que "Deshacer" solo se lo permita a quien lo
     * cerró.
     *
     * OJO: NO es lo que se pinta en el historial del cliente. Ahí va el
     * RESPONSABLE, y lo dicen las dos issues que mandan sobre esa lista —
     * JES-58 ("reaparece en el historial [...] con su responsable") y el
     * criterio de JES-64 ("los seguimientos, «Responsable:»")—. Este comentario
     * decía lo contrario y era un error.
     */
    completadoPorId: v.optional(v.id("users")),
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

  /**
   * Correos cruzados con un cliente, traídos del buzón de la empresa — JES-103.
   *
   * Tabla aparte y no una interacción más porque `interacciones.autorId` es
   * obligatorio y apunta a alguien del equipo: un correo que entra no lo ha
   * anotado nadie. Donde sí se juntan las dos cosas es en la línea de tiempo de
   * la ficha, que es donde tiene sentido verlas (`lib/historial.ts`).
   *
   * **No guarda el cuerpo**, por decisión del dueño: con el asunto y el
   * fragmento se sabe de qué iba y cuándo fue, y así la correspondencia entera
   * de los clientes no se duplica en otra base de datos.
   */
  correos: defineTable({
    clienteId: v.id("clientes"),
    /**
     * El id del mensaje en Gmail. Es lo único que impide traer dos veces el
     * mismo correo, y hace falta: la sincronización repite ventanas a propósito
     * —hay diez minutos de solape— y una acción de Convex no es transaccional.
     */
    gmailId: v.string(),
    hiloId: v.string(),
    direccion: direccionCorreo,
    /** La dirección del cliente, normalizada con `helpers.ts#normalizaEmail`. */
    contraparte: v.string(),
    asunto: v.string(),
    /** El `snippet` de Gmail: unas 200 letras. Nunca el cuerpo. */
    fragmento: v.string(),
    /** YYYY-MM-DD, día de negocio, como el resto del historial. */
    fecha: v.string(),
    /**
     * El `internalDate` de Gmail, en milisegundos: CUÁNDO SE MANDÓ el correo.
     * Por eso desempata en el historial y no lo hace `_creationTime`, que diría
     * cuándo se descargó — en una importación de treinta días, el mismo
     * instante para todos.
     */
    recibidoEn: v.number(),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_gmail", ["gmailId"]),

  /**
   * Por dónde va la lectura del buzón: la maquinaria de `correos` (JES-103).
   *
   * Una fila por buzón, con la ventana de tiempo que queda por leer,
   * `[desdeEpoch, hastaEpoch)`, que se consume **bajando el techo**.
   *
   * Que baje el techo en vez de subir el suelo no es un capricho:
   * `messages.list` devuelve de lo más nuevo a lo más viejo y no admite
   * invertirlo, así que lo que falta por leer está siempre POR DEBAJO de lo
   * leído. Subir el suelo con lo procesado en una pasada parcial se saltaba en
   * silencio todo lo anterior. Lo encontró auditoría (M1).
   */
  sincronizacionCorreo: defineTable({
    buzon: v.string(),
    /** Segundos. Suelo de la ventana pendiente. Solo sube al cerrarla. */
    desdeEpoch: v.number(),
    /** Segundos. Techo de la ventana pendiente. Baja en cada pasada parcial. */
    hastaEpoch: v.number(),
    /**
     * Segundos. El techo con el que se abrió la ventana: por encima ya está
     * todo leído. De aquí sale el suelo siguiente, y no del techo, que para
     * entonces ya ha bajado. Con el techo se volvería a recorrer entero lo
     * recién importado, y la carga inicial no alcanzaría el régimen normal.
     */
    cubiertoHasta: v.number(),
    /** Milisegundos. Cuándo acabó la última pasada, saliera bien o mal. */
    ultimaPasada: v.number(),
    /**
     * Lo que no se guardó y por qué, en números. Sin direcciones y sin
     * contenido: esto se mira para saber si hay fichas que arreglar, no para
     * leer correo.
     */
    descartados: v.object({
      sinFicha: v.number(),
      ambiguos: v.number(),
      variosClientes: v.number(),
    }),
    /** El último fallo, si lo hubo. El cron nunca lanza: lo deja aquí. */
    ultimoError: v.optional(v.string()),
  }).index("buzon", ["buzon"]),

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

  /**
   * Cuántos códigos de recuperación se han enviado a cada correo — implementa
   * parte de JES-87.
   *
   * Existe porque el límite de Convex Auth NO cubre el envío. En
   * `implementation/mutations/retrieveAccountWithCredentials.js:25` la
   * comprobación vive dentro de un `if (account.secret !== undefined)`, y el
   * flujo "reset" no lleva secret: sin esta tabla, pedir códigos sería gratis
   * e ilimitado.
   *
   * Y es una RESERVA, no un registro de lo enviado. La diferencia importa y
   * este comentario decía lo contrario: afirmaba que la tabla también impedía
   * invalidar el código de otra persona, y con el cupo aplicado en el envío no
   * lo impedía. Cada petición borra el código anterior
   * (`createVerificationCode.js:45-50`) y eso pasa ANTES del envío
   * (`implementation/signIn.js:62` frente a `:79`), así que mirar el cupo al
   * enviar llegaba tarde: el código de la otra persona ya estaba borrado.
   * Se reserva ahora en `auth.ts`, en el envoltorio de `authorize`, antes de
   * que se genere nada; y si el correo no llega a salir, esa reserva se
   * devuelve. Ver `recuperar.ts#reservarEnvio` y `#liberarReserva`.
   *
   * El email se guarda YA NORMALIZADO. Es lo que hace que el límite sea por
   * cuenta y no por variante escrita.
   */
  limitesRecuperacion: defineTable({
    /** Normalizado con `normalizaEmail`: minúsculas y sin espacios alrededor. */
    email: v.string(),
    /** Envíos dentro de la ventana en curso. */
    enviados: v.number(),
    /** Milisegundos desde epoch. Cuando la ventana caduca, se reinicia. */
    ventanaInicio: v.number(),
  })
    .index("email", ["email"])
    /** Para que la limpieza de `recuperar.ts#limpiarCaducados` encuentre las
     *  vencidas sin recorrer la tabla entera. */
    .index("ventanaInicio", ["ventanaInicio"]),
});
