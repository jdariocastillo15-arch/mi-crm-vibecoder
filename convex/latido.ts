/**
 * El latido de la lectura del buzón.
 *
 * `correos.sincronizar` está escrita para NO LANZAR NUNCA: un fallo de Google
 * se apunta en `sincronizacionCorreo.ultimoError` y la pasada siguiente
 * reintenta lo mismo. Eso evita que Convex apague el cron, y a cambio deja el
 * fallo en silencio, porque Sentry no ve lo que corre en Convex —su
 * integración es de plan Pro, JES-110— y esa fila no la mira nadie. La lectura
 * podía llevar semanas parada sin que se enterase nadie (JES-112).
 *
 * Un latido le da la vuelta al problema: en vez de avisar cuando algo falla,
 * avisa cuando DEJA DE LLEGAR la señal de que todo va bien. Better Stack espera
 * una llamada cada cierto tiempo y, si no llega dentro del plazo, abre
 * incidencia y manda un correo. Por eso cubre también el caso que ningún
 * `catch` puede cubrir: que Convex deje de lanzar el cron.
 *
 * `LATIDO_CORREO_URL` es la URL que da Better Stack al crear el latido, y es un
 * SECRETO: vive en las variables del Convex de producción y no está en el
 * repositorio. En desarrollo se deja sin poner a propósito, y entonces esto no
 * llama a nadie: ni `convex dev` ni las pruebas tocan Better Stack.
 */

/** Lo que se espera a Better Stack antes de rendirse. */
const ESPERA_MAXIMA_MS = 5_000;

/**
 * Tope del motivo que viaja en el aviso. Un error de Google puede llegar
 * larguísimo, y para saber por dónde mirar sobra con el principio.
 */
const MAXIMO_MOTIVO = 500;

/**
 * Avisa de cómo ha terminado una pasada del buzón.
 *
 * Recibe el MISMO `error` que se acaba de guardar en `sincronizacionCorreo`, y
 * no lo vuelve a deducir por su cuenta: así el latido dice exactamente lo que
 * dice la fila, y no hay dos criterios que puedan desviarse con el tiempo.
 *
 * NUNCA LANZA, y ese es el punto. Que Better Stack esté caído, o que tarde, no
 * puede tumbar la lectura del correo: sería cambiar un fallo silencioso por uno
 * peor. Si la llamada no sale queda un aviso en el registro de Convex, la
 * pasada sigue su camino, y el plazo del latido acabará venciendo solo, que es
 * justo lo que tiene que pasar.
 */
export async function avisarLatido(error: string | undefined): Promise<void> {
  const url = process.env.LATIDO_CORREO_URL;
  if (url === undefined || url.length === 0) return;

  // El límite se pide SOLO SI EXISTE. `AbortSignal` no aparece entre las APIs
  // que documenta el runtime de Convex (docs.convex.dev/functions/runtimes
  // enumera fetch, Headers, Request, Response... y no esta), y si no estuviera,
  // llamarla reventaría aquí dentro: el `catch` de abajo se lo tragaría y el
  // latido no se enviaría NUNCA, en silencio. Que es justo el fallo que esta
  // pieza existe para evitar. Sin límite, la protección sigue siendo el `try`,
  // igual que en los otros cuatro `fetch` del proyecto.
  const señal =
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(ESPERA_MAXIMA_MS)
      : undefined;

  try {
    await (error === undefined
      ? // Una llamada a secas es «la pasada ha ido bien».
        fetch(url, { signal: señal })
      : // `/fail` declara el fallo en el acto, sin esperar a que venza el
        // plazo, y el cuerpo viaja al aviso: así el correo trae el motivo y no
        // hay que entrar al panel de Convex para saber qué ha pasado.
        fetch(`${url}/fail`, {
          method: "POST",
          body: error.slice(0, MAXIMO_MOTIVO),
          signal: señal,
        }));
  } catch (fallo) {
    // La URL NO se imprime: es un secreto, y quien lea esto ya sabe de qué
    // latido se trata.
    const motivo = fallo instanceof Error ? fallo.message : "fallo desconocido";
    console.warn(`El latido del buzón no salió: ${motivo}`);
  }
}
