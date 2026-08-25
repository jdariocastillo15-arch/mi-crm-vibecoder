import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Feedback";

/**
 * Cifra de cabecera (KPI) — implementa parte de JES-41.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 359–376.
 *
 * Mono tabular siempre: las cifras tienen que poder compararse en vertical y no
 * bailar dígito a dígito al cambiar de valor.
 *
 * NO trae `Card` dentro, y es a propósito. El catálogo del design system los
 * lista como dos componentes distintos —"`Card` (title + action opcional),
 * `Metric` (KPI: label + cifra mono + delta)"—, así que la baldosa del
 * prototipo es la composición de ambos y componer es trabajo de la página.
 */
export function Metric({
  label,
  value,
  sub,
  tono = "neutral",
}: {
  label: string;
  /** Ya formateado por quien llama: un KPI no siempre son euros. */
  value: string;
  sub?: string;
  tono?: "neutral" | "info" | "success" | "error";
}) {
  /**
   * El color sale de los tokens de TEXTO (`--color-info-text`), no de los de
   * acento (`--color-info`). Los dos se adaptan al tema, así que el modo oscuro
   * no distingue uno de otro; lo que los separa es el papel: el acento tiñe
   * rellenos y puntos, y el de texto es el que el diseño pide para la cifra.
   *
   * Escritos enteros porque Tailwind busca las clases leyendo el fichero.
   */
  const color = {
    neutral: "text-text",
    info: "text-info-text",
    success: "text-success-text",
    error: "text-error-text",
  }[tono];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      <span
        className={cn("font-mono text-[28px] leading-[1.1] font-medium tabular-nums", color)}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-text-subtle">{sub}</span>}
    </div>
  );
}

/**
 * La espera de `Metric`. Vive en este fichero para que las dos formas no se
 * desvíen: si una cambia de altura, la otra se ve al lado.
 *
 * Las siluetas van algo más separadas que el contenido real (`gap-2.5` frente a
 * `gap-1.5`) porque son barras macizas: con la separación exacta del texto se
 * leen como un bloque en vez de como tres líneas.
 */
export function MetricFantasma() {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton width="45%" height={13} />
      <Skeleton width="70%" height={26} />
      <Skeleton width="55%" height={11} />
    </div>
  );
}
