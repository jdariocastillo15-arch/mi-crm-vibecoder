import { cn } from "@/lib/cn";

/**
 * Cifra de cabecera — implementa parte de JES-41.
 * Mono tabular siempre: las cifras tienen que poder compararse en vertical.
 */
export function Metric({
  label,
  value,
  sub,
  tono = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tono?: "neutral" | "info" | "success" | "error";
}) {
  const color = {
    neutral: "text-text",
    info: "text-info",
    success: "text-success",
    error: "text-error",
  }[tono];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-text-muted">{label}</span>
      <span className={cn("font-mono text-3xl font-medium tabular-nums", color)}>{value}</span>
      {sub && <span className="text-[13px] text-text-subtle">{sub}</span>}
    </div>
  );
}
