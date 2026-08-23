# Iconos de la PWA

Los tres que referencia `public/manifest.webmanifest`:

- `icon-192.png` — 192×192
- `icon-512.png` — 512×512
- `icon-maskable-512.png` — 512×512, sin esquinas redondeadas y con la marca
  reducida al 82%, porque Android recorta el maskable con la forma que quiera.
  La marca queda dentro del círculo seguro del 80%: su diagonal mide 234px
  contra los 409,6px del círculo.

La marca es la del diseño y la misma que dibuja el componente `Logo` en
`components/shell/AppShell.tsx`: cuadro verde `#16A34A`, letra "V" blanca en
Inter 600, radio del 26% del lado y letra al 56%.

## Cómo se regeneran

Se dibujan en un `<canvas>` **con la Inter de verdad**, no con un trazado
imitándola. Esto importa: Inter no está instalada en el sistema, así que
cualquier rasterizador de SVG (`sharp`, librsvg…) sustituye la tipografía en
silencio y saca una "V" que no es la del diseño sin que salte ningún error. Se
detecta solo mirando el PNG.

Si hay que rehacerlos, la receta es:

1. Una página que cargue Inter 600 de verdad.
2. Antes de pintar, comprobar que es Inter: su altura de caja es **0.7275** del
   tamaño de fuente. Si no cuadra, abortar — la fuente se ha sustituido.
3. Cuadro con `roundRect` al 26% (a sangre y sin redondear en el maskable),
   `600 {lado*0.56}px Inter`, y centrar por la **caja de tinta**
   (`actualBoundingBox…`), no por la caja de línea.

Las proporciones medidas sobre la Inter real, por si sirven de referencia:
ancho de la "V" = 0.6792 del tamaño de fuente, alto = 0.7275.
