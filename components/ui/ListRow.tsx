"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/cn";

/**
 * Fila de lista — implementa parte de JES-41.
 * Toda la fila es pulsable y alcanzable con teclado: en móvil nadie apunta a un
 * enlace de dos palabras.
 *
 * Con `href` la fila es un ENLACE de verdad, no un botón que navega. La
 * diferencia se nota: funcionan el clic central, "abrir en pestaña nueva" y el
 * menú contextual, y un lector de pantalla la anuncia como enlace. `onClick`
 * se queda para las filas que abren un overlay en vez de ir a otra pantalla.
 */
export function ListRow({
  name,
  subtitle,
  badge,
  amount,
  href,
  onClick,
  className,
}: {
  name: string;
  subtitle?: string;
  badge?: ReactNode;
  amount?: string;
  /** Destino de la fila. Tiene prioridad sobre `onClick`. */
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const interactiva = Boolean(href || onClick);

  const clases = cn(
    "flex w-full items-center gap-3 border-b border-border px-[18px] py-3.5 text-left last:border-b-0",
    interactiva && "cursor-pointer transition-colors hover:bg-surface-2",
    // El anillo de foco del sistema es una sombra que sobresale 4px, y la
    // tarjeta que envuelve la lista recorta lo que se salga de ella. Para las
    // filas se cambia por un contorno hacia dentro, que no se puede recortar.
    interactiva &&
      "focus-visible:shadow-none focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-3px]",
    className,
  );

  const contenido = (
    <>
      <Avatar name={name} size={40} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium text-text">{name}</span>
        {subtitle && (
          <span className="truncate text-[13px] text-text-muted">{subtitle}</span>
        )}
      </div>
      {amount && (
        <span className="font-mono text-[15px] font-semibold tabular-nums text-text whitespace-nowrap">
          {amount}
        </span>
      )}
      {badge}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={clases}>
        {contenido}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clases}>
        {contenido}
      </button>
    );
  }

  return <div className={clases}>{contenido}</div>;
}
