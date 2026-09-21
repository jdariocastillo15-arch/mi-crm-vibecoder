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
