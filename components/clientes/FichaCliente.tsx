"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { UserX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { EmptyState, SkeletonRow } from "@/components/ui/Feedback";
import { FichaCabecera } from "./FichaCabecera";
import { AccionesFicha, type AccionFicha } from "./AccionesFicha";
import { SeguimientosPendientes } from "./SeguimientosPendientes";
import { HistorialCliente } from "./HistorialCliente";
import { OverlayRegistrarInteraccion } from "./OverlayRegistrarInteraccion";
import { OverlayRegistrarVenta } from "./OverlayRegistrarVenta";
import { OverlayEditarCliente } from "./OverlayEditarCliente";
import { OverlayProgramarSeguimiento } from "./OverlayProgramarSeguimiento";

/**
 * Ficha de cliente — implementa JES-53.
 *
 * Busca el cliente en `api.clientes.list` en vez de llamar a `api.clientes.get`
 * con el id de la URL. No es un rodeo: `get` exige `v.id("clientes")`, así que
 * un id mal formado —`/clientes/foo`— haría que Convex rechazara el argumento y
 * la pantalla entrase en estado de error, no que devolviera `null`. Buscando en
 * la lista, un id que no existe simplemente no aparece.
 *
 * Es además la decisión que este repositorio ya tomó para el buscador de
 * clientes, y la lista suele estar ya en caché porque la usa "Nueva tarea".
 */
export function FichaCliente({ clienteId }: { clienteId: string }) {
  const clientes = useQuery(api.clientes.list);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [overlay, setOverlay] = useState<AccionFicha | null>(null);
  const [aperturas, setAperturas] = useState(0);

  // El botón "Editar" vive en la barra superior y enlaza a `?editar=1`. Así no
  // hace falta un contexto para subir el manejador desde aquí.
  const editando = searchParams.get("editar") === "1";

  // Cerrar quitando la query, no con `back()`: si alguien abrió la URL con
  // `?editar=1` directamente, un `back()` lo sacaría de la ficha.
  const cerrarEditar = () => router.replace(pathname);

  // El formulario NO se desmonta al cerrarse: lo necesita montado para que el
  // <dialog> nativo devuelva el foco a quien lo abrió. Para que aun así cada
  // apertura recargue los datos ACTUALES —y no lo que se escribió y descartó la
  // vez anterior, que es literalmente el primer criterio de JES-54— se le
  // cambia la `key` con un contador que solo avanza al ABRIR.
  //
  // Ajustar estado durante el render es el patrón que React documenta para
  // reaccionar a un cambio de entrada; es el mismo puente que usa la lista de
  // clientes con `?nuevo=1`. Contador propio y no el de las acciones rápidas,
  // porque son dos ciclos de vida independientes.
  //
  // Las `key` de los overlays llevan prefijo porque son HERMANOS, y React
  // exige que las claves no se repitan entre hermanos: dos contadores que
  // empiezan en cero daban los dos `key="0"`, y React avisaba de que podía
  // duplicar u omitir uno de ellos. Ahora son cuatro hermanos y el prefijo es
  // lo único que los distingue.
  const [editarAntes, setEditarAntes] = useState(editando);
  const [aperturasEditar, setAperturasEditar] = useState(0);
  if (editando !== editarAntes) {
    setEditarAntes(editando);
    if (editando) setAperturasEditar((n) => n + 1);
  }

  if (clientes === undefined) {
    return (
      <Card padding={false}>
        <div className="px-4.5 py-2">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </Card>
    );
  }

  const cliente = clientes.find((c) => c._id === clienteId);

  if (!cliente) {
    return (
      <Card padding={false}>
        <EmptyState
          icon={<UserX size={28} strokeWidth={1.5} aria-hidden />}
          title="Este cliente no existe"
          help="Puede que se haya borrado, o que el enlace esté mal."
        />
      </Card>
    );
  }

  function abrir(accion: AccionFicha) {
    setAperturas((n) => n + 1);
    setOverlay(accion);
  }

  const cerrarSi = (cual: AccionFicha) => () =>
    setOverlay((actual) => (actual === cual ? null : actual));

  return (
    <div className="flex flex-col gap-4 animate-vibe-slide-left">
      <FichaCabecera cliente={cliente} />

      <AccionesFicha onAccion={abrir} />

      {/* El id sale del cliente ya encontrado, no de la URL: `listByCliente`
          exige `v.id("clientes")` y un id mal formado la haría fallar. */}
      <SeguimientosPendientes clienteId={cliente._id} />

      {/* Mismo motivo que arriba para el id: sale del cliente ya encontrado. */}
      <HistorialCliente clienteId={cliente._id} />

      <OverlayProgramarSeguimiento
        key={`seguimiento-${aperturas}`}
        abierto={overlay === "seguimiento"}
        onCerrar={cerrarSi("seguimiento")}
        clienteId={cliente._id}
      />

      {/* El id sale del cliente ya encontrado, no de la URL. */}
      <OverlayRegistrarInteraccion
        key={`interaccion-${aperturas}`}
        abierto={overlay === "interaccion"}
        onCerrar={cerrarSi("interaccion")}
        clienteId={cliente._id}
      />

      {/* El id sale del cliente ya encontrado, no de la URL. */}
      <OverlayRegistrarVenta
        key={`venta-${aperturas}`}
        abierto={overlay === "venta"}
        onCerrar={cerrarSi("venta")}
        clienteId={cliente._id}
      />

      <OverlayEditarCliente
        key={`editar-${aperturasEditar}`}
        cliente={cliente}
        abierto={editando}
        onCerrar={cerrarEditar}
      />
    </div>
  );
}
