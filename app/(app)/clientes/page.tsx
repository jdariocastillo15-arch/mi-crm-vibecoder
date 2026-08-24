import { ListaClientes } from "@/components/clientes/ListaClientes";

/**
 * Ruta de la lista — implementa parte de JES-50.
 *
 * SIN límite de suspense, a diferencia de la ficha, y no por descuido.
 *
 * `ListaClientes` usa `useSearchParams` para leer `?nuevo`, y la documentación
 * de Next recomienda envolverlo en un `<Suspense>` para que lo que quede por
 * encima se pueda prerenderizar. Aquí ese beneficio es cero: la sesión la
 * comprueba el proxy, así que la ruta es dinámica y no se prerenderiza nunca —
 * `next build` la marca con `ƒ`.
 *
 * Y el coste no era cero. Con el límite puesto, Next transmite el contenido ya
 * resuelto dentro de un `<div hidden id="S:0">` que el cliente nunca consume,
 * porque `useSearchParams` obliga a renderizar ese trozo en el navegador. Queda
 * colgando del `<body>` una COPIA entera de la pantalla, con su buscador y su
 * formulario de alta. No se ve ni se puede enfocar, pero la encuentra cualquier
 * cosa que busque por etiqueta o por rol: verificando esta pantalla, un texto
 * escrito "en el buscador" acabó en la copia muerta. Pasa también en la
 * compilación de producción, no solo en desarrollo.
 *
 * La ficha no tiene ese sobrante —su página es `async` y espera `params`—, así
 * que allí el límite se queda como estaba.
 *
 * Si algún día esta ruta dejara de ser dinámica, `next build` fallará pidiendo
 * el límite. Es el sitio correcto para enterarse.
 */
export default function ClientesPage() {
  return <ListaClientes />;
}
