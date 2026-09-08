"use client";

import type { FunctionReturnType } from "convex/server";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { SkeletonRow } from "@/components/ui/Feedback";
import { ROL } from "@/lib/constants";

/**
 * La lista de la pantalla "Equipo" — implementa JES-68 y parte de JES-70.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 310–339.
 *
 * SOBRE LOS RÓTULOS DE ROL. JES-68 los escribió como «Dueña» y «Atiende y
 * vende», pero JES-84 quitó «Dueña» de la aplicación a propósito: nombra el rol
 * por lo que hace, no por quién lo tiene. La barra lateral ya dice «Lleva el
 * equipo» y el servidor responde «Solo quien lleva el equipo puede hacer esto».
 * Reintroducir la palabra aquí desharía esa decisión, así que se usa `ROL`, que
 * es la misma fuente que la barra lateral. Es una desviación consciente de la
 * letra de la issue, no un descuido.
 */

/** Una persona del equipo, tal como la devuelve el servidor. */
export type Persona = FunctionReturnType<typeof api.users.listEquipo>[number];

/**
 * ¿Se puede dar de baja a esta persona? Las dos protecciones de JES-70.
 *
 * Se repiten aquí porque el diseño exige que el botón **no aparezca**, no que
 * aparezca y falle. La regla que manda sigue estando en el servidor
 * (`users.ts#eliminarUsuario`), que las comprueba igual: esto es comodidad, no
 * seguridad, y por eso puede vivir en el cliente sin problema.
 */
export function sePuedeEliminar(
  persona: Persona,
  yoId: Id<"users"> | undefined,
  personas: Persona[],
): boolean {
  // 1 · Nadie se borra a sí mismo.
  if (persona._id === yoId) return false;

  // 2 · El equipo nunca se queda sin nadie que lo lleve.
  if (persona.rol === "propietaria") {
    const cuantas = personas.filter((p) => p.rol === "propietaria").length;
    if (cuantas <= 1) return false;
  }

  return true;
}

export function ListaEquipo({
  personas,
  yoId,
  onEditar,
  onEliminar,
}: {
  personas: Persona[];
  yoId: Id<"users"> | undefined;
  onEditar: (persona: Persona) => void;
  onEliminar: (persona: Persona) => void;
}) {
  return (
    <Card padding={false}>
      <div className="flex flex-col">
        {personas.map((persona, i) => {
          const lleva = persona.rol === "propietaria";
          return (
            <div
              key={persona._id}
              className={
                "flex items-center gap-3 px-[18px] py-3" +
                (i < personas.length - 1 ? " border-b border-border" : "")
              }
            >
              {/* Verde para quien lleva el equipo, neutro para el resto. El
                  color NO es la única señal: la etiqueta de al lado lo dice con
                  palabras (JES-73). */}
              <Avatar
                name={persona.name}
                size={40}
                variant={lleva ? "primary" : "neutral"}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium text-text">
                  {persona.name}
                </span>
                <span className="truncate text-[13px] text-text-muted">
                  {persona.email}
                </span>
              </div>

              <Badge tono={lleva ? "primary" : "neutral"} dot={false}>
                {ROL[persona.rol]}
              </Badge>

              <IconButton
                size="compact"
                aria-label={`Editar a ${persona.name}`}
                onClick={() => onEditar(persona)}
              >
                <Pencil size={18} strokeWidth={1.5} aria-hidden />
              </IconButton>

              {/* Cuando no se puede, no se dibuja NADA: ni deshabilitado ni
                  atenuado. Un botón que existe y no se deja pulsar invita a
                  intentarlo; el diseño prefiere que no esté. */}
              {sePuedeEliminar(persona, yoId, personas) && (
                <IconButton
                  size="compact"
                  variant="destructive"
                  aria-label={`Eliminar a ${persona.name}`}
                  onClick={() => onEliminar(persona)}
                >
                  <Trash2 size={18} strokeWidth={1.5} aria-hidden />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Lo que se pinta mientras llega la lista. No se inventa un recuento ni filas
 * a cero: serían datos falsos que cambian delante de los ojos.
 */
export function ListaEquipoCargando() {
  return (
    <Card padding={false}>
      <SkeletonRow />
      <SkeletonRow />
    </Card>
  );
}
