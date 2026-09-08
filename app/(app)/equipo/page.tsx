"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { LogOut, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ListaEquipo,
  ListaEquipoCargando,
  type Persona,
} from "@/components/equipo/ListaEquipo";
import { OverlayUsuario } from "@/components/equipo/OverlayUsuario";
import { DialogoEliminar } from "@/components/equipo/DialogoEliminar";

/**
 * Pantalla "Equipo" — implementa JES-68, y aloja JES-69 y JES-70.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 310–349.
 *
 * La única pantalla del MVP con permisos diferenciados: quien lleva el equipo
 * da de alta a quien haga falta y decide su rol.
 *
 * Con cualquier otro rol se muestra "Acceso restringido" y NO un error ni una
 * redirección. `nav.ts` ya esconde el enlace, pero la URL se puede teclear, y
 * quien lo haga merece una explicación en vez de un rebote. La protección de
 * verdad está en el servidor: `requirePropietaria` en cada mutación.
 */
export default function EquipoPage() {
  const yo = useQuery(api.users.me);
  const equipo = useQuery(api.users.listEquipo);

  const [editando, setEditando] = useState<Persona | null>(null);
  const [overlayAbierto, setOverlayAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState<Persona | null>(null);
  /** Cambia en cada apertura, para que el formulario empiece limpio. */
  const [apertura, setApertura] = useState(0);

  function abrirAlta() {
    setEditando(null);
    setApertura((n) => n + 1);
    setOverlayAbierto(true);
  }

  function abrirEdicion(persona: Persona) {
    setEditando(persona);
    setApertura((n) => n + 1);
    setOverlayAbierto(true);
  }

  // Mientras no se sepa quién eres no se decide nada: pintar "Acceso
  // restringido" durante la carga sería acusar a la Dueña de no serlo.
  if (yo === undefined) return <ListaEquipoCargando />;

  if (yo?.rol !== "propietaria") return <AccesoRestringido />;

  const cargando = equipo === undefined;
  const personas = equipo ?? [];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <span className="text-xs font-semibold tracking-caps text-text-subtle uppercase">
            Gestión del equipo
          </span>
          {/* No es un encabezado: el <h1> de la pantalla es el "Equipo" de la
              barra superior, que dibuja `AppShell`. Misma decisión que "Hoy" y
              "Ventas". Y mientras carga no se inventa un recuento. */}
          <p className="text-2xl font-semibold tracking-tight text-text">
            {cargando ? "Equipo" : textoRecuento(personas.length)}
          </p>
        </div>

        <Button
          variant="primary"
          size="compact"
          onClick={abrirAlta}
          iconLeft={<Plus size={18} strokeWidth={1.5} aria-hidden />}
          className="shrink-0"
        >
          Añadir usuario
        </Button>
      </header>

      {cargando ? (
        <ListaEquipoCargando />
      ) : (
        <ListaEquipo
          personas={personas}
          yoId={yo._id}
          onEditar={abrirEdicion}
          onEliminar={setAEliminar}
        />
      )}

      {/* La `key` remonta el formulario en cada apertura: sin ella, abrir para
          editar a alguien después de haber editado a otra persona enseñaría los
          datos de la anterior durante un instante. */}
      <OverlayUsuario
        key={`usuario-${apertura}`}
        abierto={overlayAbierto}
        onCerrar={() => setOverlayAbierto(false)}
        persona={editando}
      />

      <DialogoEliminar
        persona={aEliminar}
        onCerrar={() => setAEliminar(null)}
      />
    </div>
  );
}

/** «1 usuario» / «N usuarios». El singular importa con un equipo de una. */
function textoRecuento(n: number): string {
  return n === 1 ? "1 usuario" : `${n} usuarios`;
}

function AccesoRestringido() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <LogOut
          size={22}
          strokeWidth={1.5}
          className="text-text-subtle"
          aria-hidden
        />
        <h2 className="text-[15px] font-semibold text-text">
          Acceso restringido
        </h2>
        <p className="max-w-[280px] text-[13px] text-text-muted">
          Solo quien lleva el equipo puede gestionarlo.
        </p>
      </div>
    </Card>
  );
}
