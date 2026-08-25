"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { cn } from "@/lib/cn";

/**
 * Contenedor de overlay — implementa JES-43.
 *
 * Los doce formularios del CRM son overlays, no pantallas. Este componente
 * existe una vez para que la accesibilidad esté resuelta una vez.
 *
 * Está construido sobre el <dialog> nativo con `showModal()`, que ya trae
 * gratis las cuatro cosas más fáciles de hacer mal a mano: foco atrapado,
 * cierre con Escape, fondo inerte y devolución del foco a quien lo abrió.
 *
 * UN SOLO CAMINO DE CIERRE: la prop `abierto`. Todo cierre pasa por
 * `onCerrar`, que la pone en falso, y es el efecto de abajo quien toca el DOM.
 * Nunca al revés. Por eso `onCerrar` debe limitarse a eso: los efectos de un
 * guardado con éxito van en el guardado, no aquí, porque cerrar tras guardar
 * también pasa por este camino.
 *
 * El botón, el velo y el deslizamiento ya llaman a `onCerrar` ellos mismos. El
 * único cierre que se salía era **Escape**, que lo hace el navegador por su
 * cuenta: dejaba el diálogo cerrado en el DOM mientras React seguía creyéndolo
 * abierto, y entonces el overlay no volvía a abrirse nunca más.
 *
 * Se ataja escuchando `cancel` —el evento de Escape— y frenando su acción por
 * defecto, para que el cierre lo ordene React como todos los demás.
 *
 * Nota de por qué no se usa `close`, que sería lo evidente: no se dispara. Ni
 * el `onClose` de React ni un `addEventListener("close")` a pelo, ni siquiera
 * ante un `close()` programático — comprobado en Chrome 151. `cancel` sí.
 */
export function Overlay({
  abierto,
  onCerrar,
  titulo,
  children,
  pie,
  onGuardar,
  guardando = false,
  textoGuardar = "Guardar",
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  /** Sustituye el pie entero. Lo usan los diálogos de confirmación. */
  pie?: ReactNode;
  /** Con esto se dibuja el pie por defecto: "Cancelar" y "Guardar". */
  onGuardar?: () => void;
  guardando?: boolean;
  textoGuardar?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [arrastre, setArrastre] = useState(0);

  // El callback más reciente, para que el listener nativo no haya que volver a
  // enganchar en cada render.
  const alCerrarRef = useRef(onCerrar);
  useEffect(() => {
    alCerrarRef.current = onCerrar;
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const alPulsarEscape = (e: Event) => {
      e.preventDefault();
      alCerrarRef.current();
    };
    d.addEventListener("cancel", alPulsarEscape);
    return () => d.removeEventListener("cancel", alPulsarEscape);
  }, []);

  // La prop `abierto` es la única fuente de verdad. Comprobar `dialog.open`
  // antes de llamar no es defensivo por gusto: `showModal()` sobre un diálogo
  // ya abierto lanza una excepción.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  // El foco entra en el primer campo, o en el primer botón del pie si no hay
  // campos. No se deja al comportamiento nativo: varía entre navegadores, y sin
  // esto se lo queda el botón de cerrar, que es lo primero del árbol.
  //
  // Un formulario puede pedir otro campo marcándolo con `data-foco`: lo necesita
  // "Registrar interacción" (JES-62), donde el criterio pide la nota y la nota
  // va la cuarta. Toda búsqueda va acotada al diálogo y al bloque que le toca
  // —nunca al documento entero— para no acabar enfocando algo de fuera.
  useEffect(() => {
    if (!abierto) return;
    const d = ref.current;
    if (!d) return;

    const pedido = d.querySelector<HTMLElement>("[data-cuerpo] [data-foco]");
    const campo =
      pedido ??
      d.querySelector<HTMLElement>(
        "[data-cuerpo] input, [data-cuerpo] select, [data-cuerpo] textarea",
      );
    const alternativa = d.querySelector<HTMLElement>("[data-pie] button");
    (campo ?? alternativa)?.focus();

    setArrastre(0);
  }, [abierto]);

  // El <dialog> modal no impide siempre que el fondo siga desplazándose.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Deslizar hacia abajo para cerrar, en móvil. Se sigue el puntero para que el
  // gesto se vea, y solo cierra si ha recorrido lo suficiente.
  const inicioY = useRef<number | null>(null);

  function alBajarPuntero(e: React.PointerEvent) {
    inicioY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function alMoverPuntero(e: React.PointerEvent) {
    if (inicioY.current === null) return;
    setArrastre(Math.max(0, e.clientY - inicioY.current));
  }

  function alSoltarPuntero() {
    if (inicioY.current === null) return;
    inicioY.current = null;
    if (arrastre > 80) onCerrar();
    else setArrastre(0);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      /* El diálogo ocupa el hueco entero y es transparente, para que el velo de
         ::backdrop —que pinta `globals.css`, en un solo sitio para todos los
         overlays— se vea a través.

         "Pulsar fuera" se decide preguntándole al PANEL si contiene el destino
         del clic, no comparando el destino con el <dialog>. Esa comparación
         parece equivalente y no lo es: entre el diálogo y el panel hay un
         envoltorio a pantalla completa, así que un clic en el velo aterriza en
         el envoltorio y nunca en el diálogo. Así el cierre no dependía del
         velo, sino de la estructura del árbol. */
      onClick={(e) => {
        const panel = panelRef.current;
        if (panel && !panel.contains(e.target as Node)) onCerrar();
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0"
    >
      <div className="flex h-full w-full items-end justify-center md:items-center md:p-6">
        <div
          ref={panelRef}
          style={arrastre > 0 ? { transform: `translateY(${arrastre}px)` } : undefined}
          className={cn(
            "flex w-full flex-col overflow-hidden bg-surface shadow-lg",
            "max-h-[92vh] rounded-t-2xl animate-vibe-slide-up",
            "md:max-h-[90vh] md:w-[480px] md:rounded-xl md:animate-vibe-pop-in",
          )}
        >
          {/* Tirador: en móvil es el asa del gesto; en escritorio no pinta nada. */}
          <div
            onPointerDown={alBajarPuntero}
            onPointerMove={alMoverPuntero}
            onPointerUp={alSoltarPuntero}
            onPointerCancel={alSoltarPuntero}
            className="flex shrink-0 justify-center pt-2.5 pb-1 md:hidden"
            style={{ touchAction: "none" }}
          >
            <span aria-hidden className="h-1 w-9 rounded-full bg-border-strong" />
          </div>

          <header className="flex shrink-0 items-center gap-2 px-4 pt-2 pb-3 md:pt-4">
            <h2
              id={tituloId}
              className="flex-1 truncate text-[17px] font-semibold text-text"
            >
              {titulo}
            </h2>
            <IconButton aria-label="Cerrar" size="compact" onClick={onCerrar}>
              <X size={20} strokeWidth={1.5} aria-hidden />
            </IconButton>
          </header>

          <div data-cuerpo className="flex flex-col gap-4 overflow-auto px-4 pb-4">
            {children}
          </div>

          {pie ? (
            <div data-pie className="shrink-0 border-t border-border p-4">
              {pie}
            </div>
          ) : onGuardar ? (
            <div
              data-pie
              className="flex shrink-0 gap-2.5 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <Button variant="secondary" fullWidth onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                fullWidth
                loading={guardando}
                onClick={onGuardar}
              >
                {textoGuardar}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
