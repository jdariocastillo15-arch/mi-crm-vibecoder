"use client";

import Link from "next/link";
import type { Destino } from "@/components/shell/nav";
import { cn } from "@/lib/cn";

/**
 * Barra inferior de pestañas (móvil) — implementa parte de JES-41.
 *
 * Sale de `AppShell`, donde vivía como marcado suelto, porque el manifiesto del
 * paquete la declara como uno de los once componentes del sistema
 * (`components/navigation/TabBar.jsx`). Mismo marcado y mismas clases: la
 * extracción no mueve un píxel.
 *
 * No tiene estado hover, y no es un olvido: el TabBar del paquete tampoco lo
 * tiene. La barra lateral de escritorio sí, pero esa es otra pieza. En un móvil
 * no hay puntero que pasar por encima.
 */
export function TabBar({
  destinos,
  pathname,
  className,
}: {
  destinos: Destino[];
  /** Ruta actual. El destino activo es aquel cuyo `href` la prefija. */
  pathname: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        "flex shrink-0 border-t border-border bg-surface pb-safe-bottom md:hidden",
        className,
      )}
    >
      {destinos.map((d) => {
        const activo = pathname.startsWith(d.href);
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
              activo ? "font-semibold text-primary" : "font-medium text-text-subtle",
            )}
          >
            <d.icon size={22} strokeWidth={1.5} aria-hidden />
            <span className="text-[11px]">{d.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
