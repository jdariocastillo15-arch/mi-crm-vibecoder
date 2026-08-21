# Iconos de la PWA — pendientes (JES-71)

Faltan tres ficheros, que el manifiesto ya referencia:

- `icon-192.png` — 192×192
- `icon-512.png` — 512×512
- `icon-maskable-512.png` — 512×512, con la marca dentro del área segura
  (un círculo centrado del 80% del lienzo), porque Android la recorta.

La marca es la del diseño: **cuadro verde `#16A34A` con la letra "V" en blanco**,
Inter 600, radio del 26% del lado. Es la misma que dibuja el componente `Logo`
en `components/shell/AppShell.tsx`.

Sin estos ficheros la aplicación funciona, pero al instalarla en el móvil el
icono sale en blanco.
