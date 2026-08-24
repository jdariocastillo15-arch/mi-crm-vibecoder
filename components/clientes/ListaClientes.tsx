"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Plus, Search, Users, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { EmptyState, SkeletonRow } from "@/components/ui/Feedback";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { OverlayNuevoCliente } from "./OverlayNuevoCliente";
import { filtrarClientes, textoContador } from "@/lib/clientes";
import { AVISOS, ESTADO_CLIENTE } from "@/lib/constants";
import { fechaRelativa } from "@/lib/format";

/**
 * Pantalla "Clientes" — implementa JES-50 y JES-51.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 176–225.
 *
 * Encontrar a alguien sin recordar dónde se apuntó. Carlos la usa a diario y
 * casi siempre con una mano, así que el buscador filtra según se escribe: sin
 * botón de buscar y sin esperas. Las reglas del filtro viven en
 * `lib/clientes.ts`, donde se pueden leer sin JSX alrededor.
 */

/** Seis, como el diseño. No es un número redondo por gusto: llena la tarjeta. */
const FILAS_FANTASMA = [0, 1, 2, 3, 4, 5];

/** De dónde se abrió el alta. Decide cómo se sale de ella. */
type OrigenAlta = "url" | "flotante";

export function ListaClientes() {
  const clientes = useQuery(api.clientes.list);
  const { mostrar } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [consulta, setConsulta] = useState("");
  const [alta, setAlta] = useState<OrigenAlta | null>(null);
  const [apertura, setApertura] = useState(0);

  // El botón "Nuevo cliente" de la barra superior vive en `AppShell`, así que
  // no puede llamar a nada de aquí: enlaza a `?nuevo=1` y esta pantalla lo lee.
  // Es el mismo puente que ya usa "Editar" en la ficha de cliente.
  const pedidoPorUrl = searchParams.get("nuevo") === "1";

  // El formulario NO se desmonta al cerrarse: lo necesita montado para que el
  // <dialog> nativo devuelva el foco a quien lo abrió. Para que aun así cada
  // apertura empiece limpia se le cambia la `key`, con un contador que solo
  // avanza al ABRIR — si avanzara también al cerrar, el formulario se
  // desmontaría con el diálogo todavía abierto y el foco se perdería.
  //
  // Ajustar estado durante el render es el patrón que React documenta para
  // reaccionar a un cambio de entrada. En un efecto se pintaría un fotograma
  // con el formulario ya abierto y el contenido de la vez anterior.
  const [urlAntes, setUrlAntes] = useState(pedidoPorUrl);
  if (pedidoPorUrl !== urlAntes) {
    setUrlAntes(pedidoPorUrl);
    if (pedidoPorUrl) {
      setAlta("url");
      setApertura((n) => n + 1);
    }
  }

  function abrirAlta() {
    setAlta("flotante");
    setApertura((n) => n + 1);
  }

  function cerrarAlta() {
    // Si la abrió la URL, se le quita el parámetro en el sitio. `replace` y no
    // `back()`: quien llegue con `?nuevo=1` escrito a mano no tiene que salir
    // de la pantalla por cerrar el formulario.
    if (alta === "url") router.replace(pathname);
    setAlta(null);
  }

  function clienteCreado(clienteId: Id<"clientes">) {
    mostrar(AVISOS.clienteAnadido);
    const ficha = `/clientes/${clienteId}`;

    // Abierta desde `?nuevo=1`, esa entrada del historial se SUSTITUYE por la
    // ficha en vez de apilarle encima: si no, volver atrás desde la ficha
    // recaería en `?nuevo=1` y reabriría el formulario. El enlace de la barra
    // superior apila `?nuevo=1` sobre `/clientes`, así que atrás sigue
    // llevando a la lista. Desde el botón flotante la URL no ha cambiado, y
    // ahí apilar es justo lo correcto.
    if (alta === "url") router.replace(ficha);
    else router.push(ficha);

    setAlta(null);
  }

  const hayConsulta = consulta.trim() !== "";
  const cargando = clientes === undefined;
  const todos = clientes ?? [];
  const filtrados = filtrarClientes(todos, consulta);

  // Los cuatro son excluyentes y salen de la misma fuente, para que no puedan
  // verse dos a la vez (JES-51).
  const sinClientes = !cargando && todos.length === 0;
  const sinResultados = !cargando && todos.length > 0 && filtrados.length === 0;
  const hayLista = !cargando && filtrados.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Input
        // Sin etiqueta visible, así que el nombre accesible va aquí: un texto
        // de ayuda no es el nombre de un campo.
        aria-label="Buscar clientes"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        placeholder="Buscar por nombre, empresa, teléfono o email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        icon={<Search size={16} strokeWidth={1.5} />}
        accionInterior={
          hayConsulta ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setConsulta("")}
              className="inline-flex size-9 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-2"
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </button>
          ) : undefined
        }
      />

      {/* Se anuncia al cambiar: quien no ve la lista necesita saber cuántos ha
          dejado lo que acaba de escribir. El espacio duro reserva la línea
          mientras carga, para que no salte la maquetación. */}
      <span
        aria-live="polite"
        className="text-xs font-semibold tracking-caps text-text-subtle uppercase"
      >
        {cargando ? " " : textoContador(filtrados.length, hayConsulta)}
      </span>

      {cargando && (
        <Card padding={false}>
          {FILAS_FANTASMA.map((i) => (
            <SkeletonRow key={i} />
          ))}
        </Card>
      )}

      {sinClientes && (
        <Card padding={false}>
          <EmptyState
            icon={<Users size={28} strokeWidth={1.5} aria-hidden />}
            title="Sin clientes todavía"
            help="Añade tu primer cliente para empezar a vender."
            action={
              <Button variant="primary" onClick={abrirAlta}>
                Añadir cliente
              </Button>
            }
          />
        </Card>
      )}

      {sinResultados && (
        <Card padding={false}>
          <EmptyState
            icon={<Search size={28} strokeWidth={1.5} aria-hidden />}
            title="Sin resultados"
            help="No hay clientes que coincidan con tu búsqueda."
            action={
              <Button variant="secondary" onClick={() => setConsulta("")}>
                Limpiar búsqueda
              </Button>
            }
          />
        </Card>
      )}

      {hayLista && (
        <Card padding={false}>
          {filtrados.map((c) => {
            const estado = ESTADO_CLIENTE[c.estado];
            return (
              <ListRow
                key={c._id}
                href={`/clientes/${c._id}`}
                name={c.nombre}
                subtitle={`Último contacto: ${fechaRelativa(c.ultimoContacto)}`}
                badge={<Badge tono={estado.tono}>{estado.label}</Badge>}
              />
            );
          })}
        </Card>
      )}

      {/* Botón flotante, solo en móvil. En escritorio el alta está en la barra
          superior, que la dibuja `AppShell`. Se despega 20px de la barra de
          pestañas —56px— y respeta el área segura del dispositivo. */}
      <button
        type="button"
        aria-label="Nuevo cliente"
        onClick={abrirAlta}
        className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 inline-flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-colors hover:bg-primary-hover md:hidden"
      >
        <Plus size={26} strokeWidth={1.5} aria-hidden />
      </button>

      <OverlayNuevoCliente
        key={apertura}
        abierto={alta !== null}
        onCerrar={cerrarAlta}
        onCreado={clienteCreado}
      />
    </div>
  );
}
