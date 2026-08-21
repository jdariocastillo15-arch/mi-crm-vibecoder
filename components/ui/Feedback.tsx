import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Estados de carga y vacío — implementa parte de JES-41. */

/** Bloque fantasma con pulso. Debe tener la forma del contenido real. */
export function Skeleton({
  className,
  width,
  height,
  radius,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
  radius?: string | number;
}) {
  return (
    <span
      aria-hidden
      style={{ width, height, borderRadius: radius }}
      className={cn("block animate-vibe-pulse rounded-sm bg-surface-2", className)}
    />
  );
}

/** Una fila fantasma de la lista de clientes: círculo de avatar + dos líneas. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-[18px] py-3.5">
      <Skeleton width={40} height={40} radius={9999} />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton width="38%" height={13} />
        <Skeleton width="60%" height={11} />
      </div>
    </div>
  );
}

/**
 * Estado vacío: icono + título + una línea de ayuda + una acción.
 * Nunca una pantalla en blanco.
 */
export function EmptyState({
  icon,
  title,
  help,
  action,
}: {
  icon?: ReactNode;
  title: string;
  help?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && (
        <span
          aria-hidden
          className="inline-flex size-12 items-center justify-center rounded-xl bg-surface-2 text-text-muted"
        >
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-text">{title}</p>
        {help && <p className="text-[13px] text-text-muted">{help}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
