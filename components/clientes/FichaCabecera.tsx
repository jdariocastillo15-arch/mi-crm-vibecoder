import { Mail, Phone } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CANAL_ORIGEN, ESTADO_CLIENTE } from "@/lib/constants";

/**
 * Cabecera de la ficha — implementa parte de JES-53.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 226–254.
 *
 * La ficha NO muestra fecha de alta ni de último contacto: decisión del PRD.
 * Los dos datos se siguen guardando; la lista y el historial ya los enseñan.
 */
export function FichaCabecera({ cliente }: { cliente: Doc<"clientes"> }) {
  const estado = ESTADO_CLIENTE[cliente.estado];

  return (
    <Card>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start gap-3.5">
          <Avatar name={cliente.nombre} size={56} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-[19px] font-semibold text-text">
              {cliente.nombre}
            </span>
            {cliente.empresa && (
              <span className="text-sm text-text-muted">{cliente.empresa}</span>
            )}
          </div>
          <span className="shrink-0">
            <Badge tono={estado.tono}>{estado.label}</Badge>
          </span>
        </div>

        {cliente.canal && (
          <span className="self-start">
            <Badge tono="neutral" dot={false}>
              Origen: {CANAL_ORIGEN[cliente.canal]}
            </Badge>
          </span>
        )}

        {/* Las filas de contacto solo se dibujan si hay dato. Un cliente puede
            tener teléfono O email —`clientes.crear` solo exige uno—, y un
            `tel:` vacío es un enlace roto. */}
        <div className="flex flex-col border-t border-border">
          {cliente.telefono && (
            <FilaContacto
              icono={<Phone size={18} strokeWidth={1.5} aria-hidden />}
              etiqueta="Teléfono"
              valor={cliente.telefono}
              href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
              conBorde={Boolean(cliente.email)}
            />
          )}
          {cliente.email && (
            <FilaContacto
              icono={<Mail size={18} strokeWidth={1.5} aria-hidden />}
              etiqueta="Email"
              valor={cliente.email}
              href={`mailto:${cliente.email}`}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function FilaContacto({
  icono,
  etiqueta,
  valor,
  href,
  conBorde = false,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string;
  href: string;
  conBorde?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-0.5 py-3 ${conBorde ? "border-b border-border" : ""}`}
    >
      <span className="shrink-0 text-text-subtle">{icono}</span>
      <span className="w-18 shrink-0 text-[13px] text-text-subtle">{etiqueta}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{valor}</span>
    </a>
  );
}
