"use client";

import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/cn";

/**
 * Fila de lista — implementa parte de JES-41.
 * Toda la fila es pulsable y alcanzable con teclado: en móvil nadie apunta a un
 * enlace de dos palabras.
 */
export function ListRow({
  name,
  subtitle,
  badge,
  amount,
  onClick,
  className,
}: {
  name: string;
  subtitle?: string;
  badge?: ReactNode;
  amount?: string;
  onClick?: () => void;
  className?: string;
}) {
  const Etiqueta = onClick ? "button" : "div";

  return (
    <Etiqueta
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-[18px] py-3.5 text-left last:border-b-0",
        onClick && "cursor-pointer transition-colors hover:bg-surface-2",
        className,
      )}
    >
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
    </Etiqueta>
  );
}
