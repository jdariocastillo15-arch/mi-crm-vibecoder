"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chips } from "@/components/ui/Chips";
import { Skeleton } from "@/components/ui/Feedback";
import { ListaVentas, ListaVentasCargando } from "@/components/ventas/ListaVentas";
import { OverlayRegistrarVenta } from "@/components/clientes/OverlayRegistrarVenta";
import {
  FILTROS_VENTA,
  filtrarVentas,
  ordenarVentas,
  resumenVentas,
  textoOportunidades,
  textoVentasCerradas,
  type FiltroVenta,
} from "@/lib/ventas";
import { formatEuros } from "@/lib/format";

/**
 * Pantalla "Ventas y oportunidades" — implementa JES-66 y JES-67.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 351–408.
 *
 * La pantalla de Marta: cuánto hay en marcha y cuánto se ha cerrado, de un
 * vistazo y sin ir cliente por cliente. Es lo único del "Resumen del negocio"
 * del PRD original que entra en el MVP.
 *
 * UNA sola consulta para todo. Las dos cifras, los cuatro contadores y las filas
 * salen del mismo array, así que no pueden discrepar entre sí — que es uno de
 * los criterios de JES-66, no una optimización. Las reglas viven en
 * `lib/ventas.ts`.
 */
export default function VentasPage() {
  const ventas = useQuery(api.ventas.list);

  const [filtro, setFiltro] = useState<FiltroVenta>("todas");
  const [abierto, setAbierto] = useState(false);
  /** Cambia en cada apertura, para que el formulario empiece limpio. */
  const [apertura, setApertura] = useState(0);

  function abrir() {
    setApertura((n) => n + 1);
    setAbierto(true);
  }

  const cargando = ventas === undefined;
  const todas = ventas ?? [];
  const resumen = resumenVentas(todas);
  const visibles = filtrarVentas(ordenarVentas(todas), filtro);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <span className="text-xs font-semibold tracking-caps text-text-subtle uppercase">
            Registro de ventas
          </span>
          {/* No es un encabezado: el <h1> de la pantalla es el "Ventas" de la
              barra superior, que dibuja `AppShell`. Es la misma decisión que ya
              lleva la cabecera de "Hoy". */}
          <p className="text-2xl font-semibold tracking-tight text-text">
            Ventas y oportunidades
          </p>
        </div>

        {/* Aquí sí va en la pantalla y no en la barra superior, a diferencia de
            "Nuevo cliente": el diseño lo pone dentro y visible también en móvil,
            así que no hace falta el botón flotante que lleva la lista de
            clientes. */}
        <Button
          variant="primary"
          size="compact"
          onClick={abrir}
          iconLeft={<Plus size={18} strokeWidth={1.5} aria-hidden />}
          className="shrink-0"
        >
          Añadir venta
        </Button>
      </header>

      {cargando ? (
        <>
          {/* Mientras carga NO se pintan las cifras a cero ni los contadores:
              serían números falsos que cambian delante de los ojos. El filtro
              tampoco, porque no hay nada que filtrar todavía. */}
          <div className="grid grid-cols-2 gap-3">
            <MetricaFantasma />
            <MetricaFantasma />
          </div>
          <ListaVentasCargando />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metrica
              titulo="En marcha"
              importe={resumen.enMarcha}
              color="text-info-text"
              detalle={textoOportunidades(resumen.conteo.abierta)}
            />
            <Metrica
              titulo="Ganado"
              importe={resumen.ganado}
              color="text-success-text"
              detalle={textoVentasCerradas(resumen.conteo.ganada)}
            />
          </div>

          {/* El rótulo se esconde a la vista porque el diseño no lo lleva, pero
              existe: un grupo de opciones sin nombre no se puede anunciar. */}
          <Chips
            label="Filtrar ventas por estado"
            etiquetaOculta
            desliza
            opciones={FILTROS_VENTA.map((f) => ({
              valor: f.valor,
              etiqueta: `${f.etiqueta} · ${resumen.conteo[f.valor]}`,
            }))}
            valor={filtro}
            onChange={(v) => v && setFiltro(v)}
          />

          <ListaVentas ventas={visibles} filtro={filtro} />
        </>
      )}

      {/* Sin `clienteId`: desde aquí no se sabe de quién es, así que el overlay
          pregunta. Al guardar, Convex reenvía la consulta y las dos cifras y los
          cuatro contadores se recalculan solos. */}
      <OverlayRegistrarVenta
        key={`venta-${apertura}`}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
    </div>
  );
}

/**
 * Una de las dos cifras de cabecera.
 * Las perdidas no entran en ninguna: eso lo decide `resumenVentas`.
 */
function Metrica({
  titulo,
  importe,
  color,
  detalle,
}: {
  titulo: string;
  importe: number;
  /** Clase de color, escrita entera por quien llama. */
  color: string;
  detalle: string;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-text-muted">{titulo}</span>
        {/* Mono tabular para que las cifras de las dos tarjetas queden
            alineadas dígito a dígito, y no bailen al cambiar. */}
        <span
          className={`font-mono text-[28px] leading-[1.1] font-medium tabular-nums ${color}`}
        >
          {formatEuros(importe)}
        </span>
        <span className="text-xs text-text-subtle">{detalle}</span>
      </div>
    </Card>
  );
}

function MetricaFantasma() {
  return (
    <Card>
      <div className="flex flex-col gap-2.5">
        <Skeleton width="45%" height={13} />
        <Skeleton width="70%" height={26} />
        <Skeleton width="55%" height={11} />
      </div>
    </Card>
  );
}
