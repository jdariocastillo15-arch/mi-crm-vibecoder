import { Card } from "./Card";

/**
 * Marcador de pantalla pendiente. Cada uno apunta a su issue de Linear y a las
 * líneas exactas del prototipo que tiene que reproducir, para que quien la
 * construya no tenga que buscar nada.
 *
 * Se van borrando a medida que se construyen las pantallas.
 */
export function PorConstruir({
  pantalla,
  issues,
  lineas,
  descripcion,
}: {
  pantalla: string;
  issues: string[];
  lineas: string;
  descripcion: string;
}) {
  return (
    <Card title={pantalla}>
      <div className="flex flex-col gap-4 text-[15px]">
        <p className="text-text-muted">{descripcion}</p>
        <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-text-subtle">Diseño</dt>
            <dd className="font-mono text-[13px] text-text">
              DESING/design_handoff_crm_pwa/CRM Shell.dc.html · {lineas}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-text-subtle">Issues</dt>
            <dd className="text-text">{issues.join(" · ")}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
