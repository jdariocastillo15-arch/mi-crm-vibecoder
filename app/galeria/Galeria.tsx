"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Search, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Chips } from "@/components/ui/Chips";
import { EmptyState, Skeleton, SkeletonRow } from "@/components/ui/Feedback";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow } from "@/components/ui/ListRow";
import { Metric } from "@/components/ui/Metric";
import { Overlay } from "@/components/ui/Overlay";
import { TabBar } from "@/components/ui/TabBar";
import { DESTINOS } from "@/components/shell/nav";

/**
 * El contenido de la galería — criterio 2 de JES-41.
 *
 * La regla que gobierna esta página: por cada componente INTERACTIVO y cada uno
 * de los nueve estados hay **una demostración o una razón**, nunca un hueco.
 * `e2e/galeria.spec.ts` falla si aparece una celda sin ninguna de las dos, para
 * que no se pierda un estado en silencio al tocar un componente.
 *
 * Los nueve estados son una lista de comprobación, no un mínimo que todo
 * componente deba cumplir: un `Input` no tiene "seleccionado" y un `Checkbox` no
 * tiene "cargando". Lo que el criterio exige es que ninguno quede sin resolver.
 */

const ESTADOS = [
  "reposo",
  "hover",
  "foco",
  "pulsado",
  "deshabilitado",
  "error",
  "cargando",
  "vacio",
  "seleccionado",
] as const;

type Estado = (typeof ESTADOS)[number];

/** Una demostración del estado, o la razón por la que ese estado no existe. */
type Celda = { demo: ReactNode } | { razon: string };

type Ficha = { nombre: string; slug: string; celdas: Partial<Record<Estado, Celda>> };

const NADA_INTERACTIVO = "No es interactivo: no hay puntero ni foco que reflejar.";

function Cuadricula({ ficha }: { ficha: Ficha }) {
  return (
    <section className="flex flex-col gap-3" data-componente={ficha.slug}>
      <h2 className="text-[17px] font-semibold text-text">{ficha.nombre}</h2>
      <div className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 rounded-xl border border-border bg-surface p-4">
        {ESTADOS.map((estado) => {
          const celda = ficha.celdas[estado];
          const esDemo = celda !== undefined && "demo" in celda;
          return (
            <div key={estado} className="contents">
              <span className="self-center text-[13px] font-medium text-text-muted">
                {estado}
              </span>
              <div
                data-testid={`${ficha.slug}-${estado}`}
                data-tipo={celda === undefined ? "hueco" : esDemo ? "demo" : "razon"}
                className="flex min-h-11 items-center gap-3 border-b border-border py-2 last:border-b-0"
              >
                {celda === undefined ? (
                  <span className="text-[13px] text-error-text">
                    Sin resolver. Esto es un fallo de la galería, no del componente.
                  </span>
                ) : esDemo ? (
                  celda.demo
                ) : (
                  <span className="text-[13px] text-text-subtle">{celda.razon}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * El interruptor de la galería escribe en el `<html>`, igual que la aplicación.
 *
 * NO PUEDE ESCRIBIR EN SU PROPIO LIENZO. Desde JES-72 el `<html>` ya lleva
 * `data-theme`, y las propiedades de color se heredan: con el sistema en
 * oscuro, un lienzo sin atributo hereda ese oscuro y «Ver en claro» no hace
 * nada. Poner `data-theme="light"` en el lienzo tampoco lo arregla, porque en
 * `globals.css` el único bloque que existe es `[data-theme="dark"]`: no hay
 * reglas de claro que puedan ganarle a las heredadas.
 */
function suscribirAlTema(alCambiar: () => void) {
  const observador = new MutationObserver(alCambiar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observador.disconnect();
}

/** El modo vive en el DOM, no en un estado de React. */
function leerTema() {
  return document.documentElement.dataset.theme === "dark";
}

/**
 * En el servidor no hay `<html>` que consultar, y `layout.tsx` lo pinta en
 * claro. Sin esta tercera función `useSyncExternalStore` lanza al renderizar
 * en el servidor, y la galería se pinta también ahí.
 */
function temaDelServidor() {
  return false;
}

export function Galeria() {
  /**
   * El modo se LEE del `<html>` en vez de llevar una cuenta aparte, porque ese
   * atributo lo tocan dos manos: este botón y `TemaDelSistema`, que sigue al
   * sistema operativo. Con un `useState` propio, cambiar la preferencia del
   * sistema movería el lienzo y dejaría el rótulo del botón mintiendo.
   */
  const oscuro = useSyncExternalStore(suscribirAlTema, leerTema, temaDelServidor);

  /**
   * ¿Ha tocado la galería el tema? Es un `ref` y no un estado porque solo lo
   * mira la limpieza de abajo: como estado volvería a montar el efecto en cada
   * pulsación, y la limpieza correría a destiempo.
   */
  const tocado = useRef(false);

  useEffect(() => {
    return () => {
      if (!tocado.current) return;
      // El interruptor es de esta página. Al salir, el `<html>` vuelve a lo que
      // diga el sistema: si no, la galería se llevaría su modo al resto de la
      // aplicación, que no tiene ningún interruptor con el que deshacerlo.
      document.documentElement.dataset.theme = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches
        ? "dark"
        : "light";
    };
  }, []);

  const alternarTema = () => {
    tocado.current = true;
    document.documentElement.dataset.theme = oscuro ? "light" : "dark";
  };

  // Arranca MARCADA: esta celda documenta el estado «seleccionado», así que
  // tiene que enseñarlo en reposo, no esconderlo detrás de un clic.
  const [marcada, setMarcada] = useState(true);
  const [chip, setChip] = useState<"a" | "b" | null>("a");
  const [overlay, setOverlay] = useState(false);

  const fichas: Ficha[] = [
    {
      nombre: "Button",
      slug: "button",
      celdas: {
        reposo: { demo: <Button variant="primary">Guardar</Button> },
        hover: { demo: <Button variant="primary">Pasa el puntero</Button> },
        foco: { demo: <Button variant="primary">Tabula hasta aquí</Button> },
        pulsado: { demo: <Button variant="primary">Mantén pulsado</Button> },
        deshabilitado: { demo: <Button variant="primary" disabled>Guardar</Button> },
        error: {
          razon:
            "No lo tiene: el error vive en el campo que se valida, no en el botón que envía.",
        },
        cargando: { demo: <Button variant="primary" loading>Guardando</Button> },
        vacio: { razon: "No aplica: un botón siempre tiene su rótulo." },
        seleccionado: {
          razon: "No aplica: un botón dispara una acción, no queda elegido. Eso es Chips.",
        },
      },
    },
    {
      nombre: "IconButton",
      slug: "iconbutton",
      celdas: {
        reposo: { demo: <IconButton aria-label="Borrar"><Trash2 size={18} strokeWidth={1.5} /></IconButton> },
        hover: { demo: <IconButton aria-label="Borrar, hover"><Trash2 size={18} strokeWidth={1.5} /></IconButton> },
        foco: { demo: <IconButton aria-label="Borrar, foco"><Trash2 size={18} strokeWidth={1.5} /></IconButton> },
        pulsado: {
          razon: "No lo tiene, y es el contrato del paquete: solo el Button primario baja al pulsar.",
        },
        deshabilitado: {
          demo: <IconButton aria-label="Borrar, deshabilitado" disabled><Trash2 size={18} strokeWidth={1.5} /></IconButton>,
        },
        error: { razon: "No lo tiene: no valida nada." },
        cargando: {
          razon: "No lo tiene en el paquete, a diferencia de Button. Sin `loading` en su contrato.",
        },
        vacio: { razon: "No aplica: siempre lleva su icono." },
        seleccionado: { razon: "No aplica: dispara una acción, no queda elegido." },
      },
    },
    {
      nombre: "Input",
      slug: "input",
      celdas: {
        reposo: { demo: <Input label="Nombre" placeholder="Ana García" /> },
        hover: { razon: "No lo tiene: un campo de texto no cambia al pasar el puntero." },
        foco: { demo: <Input label="Nombre, foco" placeholder="Tabula hasta aquí" /> },
        pulsado: { razon: "No aplica: no es un control que se pulse." },
        deshabilitado: { demo: <Input label="Nombre" defaultValue="Ana García" disabled /> },
        error: { demo: <Input label="Correo" defaultValue="ana@" error="Formato no válido" /> },
        cargando: { razon: "No lo tiene: quien carga es la pantalla, y para eso está Skeleton." },
        vacio: { demo: <Input label="Nombre" placeholder="Vacío, con marcador" /> },
        seleccionado: { razon: "No aplica a un campo de texto." },
      },
    },
    {
      nombre: "Textarea",
      slug: "textarea",
      celdas: {
        reposo: { demo: <Textarea label="Nota" placeholder="Escribe aquí" /> },
        hover: { razon: "No lo tiene, igual que Input." },
        foco: { demo: <Textarea label="Nota, foco" /> },
        pulsado: { razon: "No aplica: no es un control que se pulse." },
        deshabilitado: { demo: <Textarea label="Nota" defaultValue="Bloqueada" disabled /> },
        error: { demo: <Textarea label="Nota" error="La nota es obligatoria" /> },
        cargando: { razon: "No lo tiene, igual que Input." },
        vacio: { demo: <Textarea label="Nota" placeholder="Vacía, con marcador" /> },
        seleccionado: { razon: "No aplica a un campo de texto." },
      },
    },
    {
      nombre: "Select",
      slug: "select",
      celdas: {
        reposo: {
          demo: (
            <Select label="Canal" defaultValue="tel">
              <option value="tel">Teléfono</option>
              <option value="mail">Correo</option>
            </Select>
          ),
        },
        hover: { razon: "No lo tiene, igual que Input." },
        foco: {
          demo: (
            <Select label="Canal, foco">
              <option>Teléfono</option>
            </Select>
          ),
        },
        pulsado: { razon: "El desplegable lo abre el navegador; no hay estado propio." },
        deshabilitado: {
          demo: (
            <Select label="Canal" disabled>
              <option>Teléfono</option>
            </Select>
          ),
        },
        error: {
          demo: (
            <Select label="Canal" error="Elige un canal">
              <option>—</option>
            </Select>
          ),
        },
        cargando: { razon: "No lo tiene, igual que Input." },
        vacio: {
          demo: (
            <Select label="Canal">
              <option value="">Sin elegir</option>
            </Select>
          ),
        },
        seleccionado: {
          razon: "Lo gestiona el navegador dentro del desplegable, no el componente.",
        },
      },
    },
    {
      nombre: "Checkbox",
      slug: "checkbox",
      celdas: {
        reposo: { demo: <Checkbox marcado={false} onChange={() => {}} aria-label="Sin marcar" /> },
        hover: { demo: <Checkbox marcado={false} onChange={() => {}} aria-label="Hover" /> },
        foco: { demo: <Checkbox marcado={false} onChange={() => {}} aria-label="Foco" /> },
        pulsado: { razon: "No lo tiene: el cambio a marcado ya es la respuesta al toque." },
        deshabilitado: {
          demo: <Checkbox marcado={false} onChange={() => {}} aria-label="Deshabilitada" disabled />,
        },
        error: { razon: "No lo tiene: no valida nada por sí sola." },
        cargando: { razon: "No lo tiene. La mutación en vuelo se tapa con `disabled`." },
        vacio: { razon: "No aplica: sin marcar ya es su estado de partida." },
        seleccionado: {
          demo: (
            <Checkbox
              marcado={marcada}
              onChange={() => setMarcada((v) => !v)}
              aria-label="Alterna el marcado"
            />
          ),
        },
      },
    },
    {
      nombre: "Chips",
      slug: "chips",
      celdas: {
        reposo: {
          demo: (
            <Chips
              label="Estado"
              valor={chip}
              onChange={setChip}
              opciones={[
                { valor: "a", etiqueta: "Abierta" },
                { valor: "b", etiqueta: "Ganada" },
              ]}
            />
          ),
        },
        hover: { razon: "Lo tiene la opción inactiva del aspecto «texto»; se ve en la celda de reposo." },
        foco: { razon: "Anillo del sistema; la opción activa lo cambia por un contorno. Ver reposo." },
        pulsado: { razon: "No lo tiene: el cambio de opción activa ya es la respuesta." },
        deshabilitado: { razon: "No lo tiene: ningún filtro del producto se apaga." },
        error: {
          demo: (
            <Chips
              label="Estado"
              valor={null}
              onChange={() => {}}
              permitirVaciar
              error="Elige un estado"
              opciones={[{ valor: "a", etiqueta: "Abierta" }]}
            />
          ),
        },
        cargando: { razon: "No lo tiene: las opciones son fijas, no se piden al servidor." },
        vacio: {
          razon: "No aplica: siempre recibe opciones. Sin selección es `valor = null`, que ya es la celda de error.",
        },
        seleccionado: { razon: "Es su estado central; se ve en la celda de reposo." },
      },
    },
    {
      nombre: "ListRow",
      slug: "listrow",
      celdas: {
        reposo: { demo: <ListRow name="Ana García" subtitle="Acme SL" onClick={() => {}} className="w-full" /> },
        hover: { demo: <ListRow name="Hover" subtitle="Pasa el puntero" onClick={() => {}} className="w-full" /> },
        foco: { demo: <ListRow name="Foco" subtitle="Tabula hasta aquí" onClick={() => {}} className="w-full" /> },
        pulsado: { razon: "No lo tiene: la fila navega, y el cambio de pantalla ya es la respuesta." },
        deshabilitado: { razon: "No lo tiene: una fila que no se puede abrir simplemente no lleva `href` ni `onClick`." },
        error: { razon: "No lo tiene: no valida nada." },
        cargando: { razon: "Lo cubre `SkeletonRow`, que es su componente hermano." },
        vacio: { razon: "Lo cubre `EmptyState`: el vacío es de la lista, no de la fila." },
        seleccionado: {
          demo: <ListRow name="Seleccionada" subtitle="Fondo surface-2" seleccionado className="w-full" />,
        },
      },
    },
    {
      nombre: "TabBar",
      slug: "tabbar",
      celdas: {
        reposo: { demo: <div className="w-full max-w-100"><TabBar destinos={DESTINOS} pathname="/hoy" className="md:flex!" /></div> },
        hover: {
          razon: "No lo tiene, y es el contrato: el TabBar del paquete no define hover. En un móvil no hay puntero.",
        },
        foco: { razon: "Anillo del sistema sobre cada destino. Ver la celda de reposo." },
        pulsado: { razon: "No lo tiene: es un enlace, y el cambio de pantalla ya es la respuesta." },
        deshabilitado: { razon: "No lo tiene: un destino que no toca no se pinta, se quita. «Equipo» con un comercial." },
        error: { razon: "No aplica a una barra de navegación." },
        cargando: { razon: "No lo tiene: los destinos son fijos." },
        vacio: { razon: "No aplica: siempre hay al menos tres destinos." },
        seleccionado: {
          demo: <div className="w-full max-w-100"><TabBar destinos={DESTINOS} pathname="/ventas" className="md:flex!" /></div>,
        },
      },
    },
    {
      nombre: "Overlay",
      slug: "overlay",
      celdas: {
        reposo: {
          demo: <Button onClick={() => setOverlay(true)}>Abrir overlay</Button>,
        },
        hover: { razon: "No lo tiene el contenedor; lo tienen los botones de su pie." },
        foco: { razon: "Lo atrapa dentro al abrirse y lo devuelve al cerrar. Se prueba abriéndolo." },
        pulsado: { razon: "No aplica al contenedor." },
        deshabilitado: { razon: "No aplica: un overlay se abre o no existe." },
        error: { razon: "No lo tiene: el error vive en los campos que contiene." },
        cargando: { razon: "Sí lo tiene, vía `guardando`, que pone el Button del pie en `loading`." },
        vacio: { razon: "No aplica: siempre recibe contenido." },
        seleccionado: { razon: "No aplica a un contenedor modal." },
      },
    },
  ];

  return (
    <div data-testid="lienzo" className="min-h-dvh bg-bg">
      <div className="mx-auto flex w-full max-w-content-max flex-col gap-8 px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-semibold tracking-tight text-text">
              Galería de componentes
            </h1>
            <p className="text-[13px] text-text-muted">
              Los nueve estados de cada componente interactivo. Cada celda trae una
              demostración o la razón de su ausencia. Solo existe en desarrollo.
            </p>
          </div>
          {/* Escribe en el `<html>`, que es donde vive el modo desde JES-72.
              Sin este botón no se pueden ver los estados en oscuro, que es la
              mitad del criterio 5 de JES-41. */}
          <Button
            data-testid="cambiar-tema"
            onClick={alternarTema}
            aria-pressed={oscuro}
          >
            {oscuro ? "Ver en claro" : "Ver en oscuro"}
          </Button>
        </header>

        {fichas.map((f) => (
          <Cuadricula key={f.slug} ficha={f} />
        ))}

        <section className="flex flex-col gap-3" data-componente="no-interactivos">
          <h2 className="text-[17px] font-semibold text-text">
            No interactivos
          </h2>
          <p className="text-[13px] text-text-subtle">{NADA_INTERACTIVO} El criterio 2 habla de componentes interactivos, así que estos salen como documentación y no se les exige la matriz.</p>
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name="Ana García" size={40} />
              <Avatar name="Carlos Ruiz" size={32} variant="neutral" />
              <Badge tono="success">Ganada</Badge>
              <Badge tono="error">Perdida</Badge>
              <Badge tono="neutral" dot={false}>Sin punto</Badge>
            </div>
            <div className="flex flex-wrap gap-4">
              <Metric label="En marcha" value="€12.400" sub="4 operaciones" tono="info" />
              <Metric label="Ganado" value="€8.900" sub="Este mes" tono="success" />
            </div>
            <Card title="Una tarjeta" action={<Button size="compact">Acción</Button>}>
              <p className="text-[15px] text-text-muted">Contenido de la tarjeta.</p>
            </Card>
            <div className="flex flex-col gap-2">
              <Skeleton width="60%" height={13} />
              <SkeletonRow />
            </div>
            <EmptyState
              icon={<Search size={28} strokeWidth={1.5} aria-hidden />}
              title="Sin resultados"
              help="Prueba con otro término."
            />
          </div>
        </section>
      </div>

      <Overlay
        abierto={overlay}
        onCerrar={() => setOverlay(false)}
        titulo="Overlay de ejemplo"
        onGuardar={() => setOverlay(false)}
      >
        <div className="flex flex-col gap-4 p-4">
          <Input label="Un campo dentro" placeholder="El foco entra aquí al abrir" />
        </div>
      </Overlay>
    </div>
  );
}
