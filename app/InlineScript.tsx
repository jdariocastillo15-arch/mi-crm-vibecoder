/**
 * El script del tema, en una constante y no copiado en cada sitio.
 *
 * Lo usan DOS documentos: `app/layout.tsx` y `app/global-error.tsx`, que
 * reemplaza al anterior cuando revienta el layout raíz. Escrito dos veces, el
 * día que se arregle uno el otro se queda con el fallo — y el segundo es
 * justo la pantalla que nadie mira hasta que hace falta.
 */
export const SCRIPT_DEL_TEMA =
  "(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches)" +
  "{document.documentElement.dataset.theme='dark'}}catch(e){}})()";

/**
 * Un script que corre mientras el navegador analiza el HTML — implementa parte
 * de JES-72.
 *
 * El envoltorio no es adorno: React avisa en desarrollo cuando el renderizado
 * produce etiquetas `<script>`. La guía de Next lo resuelve poniendo
 * `type="text/javascript"` en el servidor y `text/plain` en el cliente, para que
 * el navegador lo ejecute una sola vez al analizar y no al hidratar.
 * `suppressHydrationWarning` se traga la diferencia entre los dos tipos.
 *
 * Fuente: `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`,
 * sección «Extracting a reusable component».
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
