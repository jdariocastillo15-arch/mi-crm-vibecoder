import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tarjeta — implementa parte de JES-41.
 * Superficie blanca + borde de 1px + sombra muy sutil. Es la base de toda
 * composición sobre el lienzo gris.
 *
 * `padding={false}` cuando la tarjeta contiene una lista a sangre.
 */
export function Card({
  title,
  action,
  padding = true,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  padding?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-xs",
        className,
      )}
    >
      {title && (
        <header className="flex items-center gap-2 px-5 pt-5 pb-3">
          <h2 className="flex-1 text-[15px] font-semibold text-text">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn(padding && (title ? "px-5 pb-5" : "p-5"))}>{children}</div>
    </section>
  );
}
