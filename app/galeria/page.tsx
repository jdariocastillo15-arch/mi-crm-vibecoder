import { notFound } from "next/navigation";
import { Galeria } from "./Galeria";

/**
 * Galería de componentes — implementa el criterio 2 de JES-41.
 *
 * Existe para dos cosas a la vez, que es lo que pide el criterio: DOCUMENTAR
 * los nueve estados de cada componente interactivo, y darle a Playwright una
 * página donde PROBARLOS en un navegador de verdad. Siete de los nueve estados
 * son visuales, y en jsdom no se calcula CSS: allí "el anillo de foco se ve"
 * solo comprueba que una cadena de clases contiene un texto.
 *
 * Esta página es de SERVIDOR y no hace más que la guarda: todo lo interactivo
 * vive en `Galeria`, que es de cliente. `notFound()` necesita estar aquí.
 *
 * Es la primera vez que este repositorio ramifica por `NODE_ENV`. Hasta ahora
 * el único guardarraíl de "solo desarrollo" vivía en `playwright.config.ts` y
 * miraba `CONVEX_DEPLOYMENT`. La segunda guarda es la lista de rutas públicas
 * de `middleware.ts`, que además deja entrar sin sesión.
 */
export default function PaginaGaleria() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Galeria />;
}
