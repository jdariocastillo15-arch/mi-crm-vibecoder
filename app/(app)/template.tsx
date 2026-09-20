/**
 * El fundido al cambiar de pestaña — cierra el criterio 6 de JES-42.
 *
 * POR QUÉ UN `template` Y NO EL `layout`. Un `layout` persiste entre rutas: la
 * clase de animación se aplicaría una sola vez, al entrar en la aplicación, y
 * nunca más. Un `template` recibe una clave única y **se remonta** cuando cambia
 * su segmento, y al remontarse el CSS vuelve a disparar la animación. Está en
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/template.md`
 * de esta versión, la 16.3.5.
 *
 * POR QUÉ NO HACE FALTA MIRAR LA RUTA. Ese mismo documento dice que «las
 * navegaciones dentro de segmentos más profundos no remontan los templates de
 * nivel superior». Como este vive en `(app)`, se remonta al saltar entre `/hoy`,
 * `/clientes`, `/ventas`, `/equipo` y `/cuenta` —donde el criterio pide el
 * fundido— y NO al pasar de `/clientes` a `/clientes/[id]`, donde pide el
 * desplazamiento horizontal y ya lo pone `FichaCliente`. Los dos efectos no se
 * pisan solos, sin condicionales.
 *
 * Quien pide menos movimiento no ve nada de esto: `globals.css` anula las
 * animaciones con `prefers-reduced-motion` para todo el documento.
 */
export default function PlantillaDePestanas({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-vibe-fade-in">{children}</div>;
}
