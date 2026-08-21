import { cn } from "@/lib/cn";
import { iniciales } from "@/lib/format";

/**
 * Avatar de iniciales — implementa parte de JES-41.
 * La interfaz es data-first: no hay fotos.
 */
export function Avatar({
  name,
  size = 40,
  variant = "primary",
  className,
}: {
  name: string;
  size?: 20 | 22 | 32 | 40 | 56;
  variant?: "primary" | "neutral";
  className?: string;
}) {
  // El tamaño de letra acompaña al del círculo.
  const fuente = size <= 22 ? 9 : size <= 32 ? 12 : size <= 40 ? 14 : 18;

  return (
    <span
      title={name}
      aria-hidden
      style={{ width: size, height: size, fontSize: fuente }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        variant === "primary"
          ? "bg-primary-subtle text-primary"
          : "bg-surface-2 text-text-muted",
        className,
      )}
    >
      {iniciales(name)}
    </span>
  );
}
