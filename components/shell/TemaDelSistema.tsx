"use client";

import { useLayoutEffect } from "react";

/**
 * El modo claro u oscuro, siguiendo al sistema operativo — implementa JES-72.
 *
 * NO HAY INTERRUPTOR, y es deliberado. `app/layout.tsx` ya declara el color de
 * la barra del navegador por `prefers-color-scheme`, y el `theme_color` del
 * manifiesto es un valor único que no admite media queries. Seguir al sistema es
 * lo único que deja a la barra y al lienzo de acuerdo.
 *
 * ESTE COMPONENTE EXISTE POR UN MOTIVO CONCRETO, no por gusto. El script de
 * `layout.tsx` pone el atributo antes del primer pintado, que es lo que evita el
 * destello. Pero en desarrollo el modo estricto de React remonta una vez y, al
 * hacerlo, «resets `<html>`, `<head>`, and `<body>` to only the attributes it
 * manages from JSX, clearing the one the script set» — literal de la guía de
 * Next, `preventing-flash-before-hydration.md`. Sin esto, la aplicación se
 * quedaría en claro justo en desarrollo, que es donde corren las pruebas.
 *
 * `useLayoutEffect` y no `useEffect`: corre ANTES de pintar. Con `useEffect` se
 * vería primero el valor del servidor y después la corrección.
 *
 * La suscripción vive aquí y no dentro del script para que tenga limpieza: un
 * `addEventListener` suelto en el script se acumularía en cada remontaje.
 */
export function TemaDelSistema() {
  useLayoutEffect(() => {
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");

    const aplicar = () => {
      const raiz = document.documentElement;
      raiz.dataset.theme = consulta.matches ? "dark" : "light";
      // Señal de que la hidratación ya ha pasado y el atributo es definitivo.
      // Es solo para las pruebas: ni es una preferencia guardada, ni una API
      // del producto, ni nada en lo que deba apoyarse ningún componente.
      raiz.dataset.temaListo = "1";
    };

    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  return null;
}
