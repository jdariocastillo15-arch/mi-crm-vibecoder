"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { UserX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { EmptyState, SkeletonRow } from "@/components/ui/Feedback";
import { PorConstruir } from "@/components/ui/PorConstruir";
import { OverlayPorConstruir } from "@/components/ui/OverlayPorConstruir";
import { FichaCabecera } from "./FichaCabecera";
import { AccionesFicha, type AccionFicha } from "./AccionesFicha";
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

      <PorConstruir
        pantalla="Lo que falta de esta ficha"
        descripcion="Seguimientos pendientes, y el historial unificado con interacciones, ventas y seguimientos completados en una sola línea de tiempo."
        lineas="líneas 260–309 (marcado) · 959–971 (historial)"
        issues={["JES-61", "JES-64"]}
      />

      <OverlayProgramarSeguimiento
        key={aperturas}
        abierto={overlay === "seguimiento"}
        onCerrar={cerrarSi("seguimiento")}
        clienteId={cliente._id}
      />

      <OverlayPorConstruir
        abierto={overlay === "interaccion"}
        onCerrar={cerrarSi("interaccion")}
        titulo="Registrar interacción"
        issue="JES-62"
        lineas="líneas 540–566"
        descripcion="Canal, qué se habló y la fecha. Abierto desde la ficha ya sabe de qué cliente es, y al guardar adelanta su fecha de último contacto."
      />

      <OverlayPorConstruir
        abierto={overlay === "venta"}
        onCerrar={cerrarSi("venta")}
        titulo="Registrar venta"
        issue="JES-65"
        lineas="líneas 567–600"
        descripcion="Concepto, importe en euros, estado y fecha. Abierto desde la ficha ya sabe de qué cliente es. Una venta no cuenta como contacto."
      />

      <OverlayPorConstruir
        abierto={editando}
        onCerrar={cerrarEditar}
        titulo="Editar cliente"
        issue="JES-54"
        lineas="líneas 476–514"
        descripcion="Los mismos campos del alta más el estado del cliente, que solo se puede cambiar desde aquí."
      />
    </div>
  );
}
