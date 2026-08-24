import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { SkeletonRow } from "@/components/ui/Feedback";
import { FichaCliente } from "@/components/clientes/FichaCliente";

/**
 * Ruta de la ficha — implementa parte de JES-53.
 *
 * Este componente es de servidor y hace una sola cosa: esperar `params`, que en
 * esta versión de Next es una promesa, y pasar el id al cliente.
 *
 * El `<Suspense>` no es decorativo: `FichaCliente` usa `useSearchParams` para
 * leer `?editar`, y la documentación de Next pide envolver en un límite de
 * suspense todo componente de cliente que lo use, o el prerenderizado se
 * arrastra hasta el límite más cercano.
 */
export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<Cargando />}>
      <FichaCliente clienteId={id} />
    </Suspense>
  );
}

function Cargando() {
  return (
    <Card padding={false}>
      <div className="px-4.5 py-2">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </Card>
  );
}
