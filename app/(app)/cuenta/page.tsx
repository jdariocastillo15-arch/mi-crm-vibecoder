"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight, Lock, LogOut, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { OverlayEditarDatos } from "@/components/cuenta/OverlayEditarDatos";
import { OverlayCambiarContrasena } from "@/components/cuenta/OverlayCambiarContrasena";
import { DialogoCerrarSesion } from "@/components/cuenta/DialogoCerrarSesion";
import { ROL } from "@/lib/constants";

/**
 * Pantalla "Mi cuenta" — implementa JES-48, y aloja JES-49.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 410–441.
 *
 * Se llega desde el avatar de la barra superior en móvil y desde el bloque de
 * usuario al pie de la barra lateral en escritorio; las dos entradas las dibuja
 * `AppShell`. Que se abra a pantalla completa, oculte las pestañas y muestre el
 * botón de atrás lo decide `nav.ts#esPantallaCompleta`, que ya incluía
 * `/cuenta`.
 */
export default function CuentaPage() {
  const me = useQuery(api.users.me);

  const [editandoDatos, setEditandoDatos] = useState(false);
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  /** Cambia en cada apertura, para que los formularios empiecen limpios. */
  const [apertura, setApertura] = useState(0);

  function abrir(cual: "datos" | "contrasena") {
    setApertura((n) => n + 1);
    if (cual === "datos") setEditandoDatos(true);
    else setCambiandoContrasena(true);
  }

  // `undefined` es que todavía no ha llegado; `null` es que no hay sesión. Son
  // cosas distintas y se tratan distinto: pintar "no hay sesión" mientras carga
  // acusaría de estar fuera a quien está dentro.
  if (me === undefined) return <CuentaCargando />;
  if (me === null) return <SinSesion />;

  const nombre = me.name ?? "";
  const email = me.email ?? "";
  const rol = me.rol ?? "comercial";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={nombre || "?"} size={56} />
          <div className="flex min-w-0 flex-col gap-[7px]">
            <span className="truncate text-[19px] font-semibold tracking-tight text-text">
              {nombre || "Sin nombre"}
            </span>
            <span>
              <Badge tono={rol === "propietaria" ? "primary" : "neutral"}>
                {ROL[rol]}
              </Badge>
            </span>
            {email && (
              <span className="truncate text-[13px] text-text-muted">
                {email}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <div className="flex flex-col">
          <FilaOpcion
            icono={<Pencil size={18} strokeWidth={1.5} aria-hidden />}
            onClick={() => abrir("datos")}
          >
            Editar mis datos
          </FilaOpcion>

          {/* Solo si esa contraseña existe y es suya. Quien todavía no la ha
              establecido entra por código o con Google, y ofrecerle "cambiar"
              algo que nunca eligió es el mismo maltrato que arregló JES-92.

              Esconder la fila NO autoriza nada: `cuenta.cambiarContrasena`
              vuelve a comprobarlo en el servidor. */}
          {me.tieneContrasena ? (
            <FilaOpcion
              icono={<Lock size={18} strokeWidth={1.5} aria-hidden />}
              onClick={() => abrir("contrasena")}
            >
              Cambiar contraseña
            </FilaOpcion>
          ) : (
            // El texto se queda en "no has establecido contraseña" y NO dice
            // por qué puerta entra: `tieneContrasena` habla de la credencial,
            // no del proveedor. Quien entra por código tampoco la tiene.
            <p className="border-t border-border px-[18px] py-3.5 text-[13px] text-text-muted">
              Todavía no has establecido una contraseña. Puedes hacerlo desde la
              pantalla de acceso, poniendo tu correo y pidiendo el código.
            </p>
          )}
        </div>
      </Card>

      <button
        type="button"
        onClick={() => setCerrandoSesion(true)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-surface text-[15px] font-semibold text-error-text transition-colors hover:bg-error-bg"
      >
        <LogOut size={18} strokeWidth={1.5} aria-hidden />
        Cerrar sesión
      </button>

      {/* La `key` remonta el formulario en cada apertura: sin ella, volver a
          abrirlo enseñaría lo que se tecleó la vez anterior. En "Cambiar
          contraseña" eso serían contraseñas escritas, así que no es cosmético. */}
      <OverlayEditarDatos
        key={`datos-${apertura}`}
        abierto={editandoDatos}
        onCerrar={() => setEditandoDatos(false)}
        nombreActual={nombre}
        email={email}
      />

      <OverlayCambiarContrasena
        key={`contrasena-${apertura}`}
        abierto={cambiandoContrasena}
        onCerrar={() => setCambiandoContrasena(false)}
      />

      <DialogoCerrarSesion
        abierto={cerrandoSesion}
        onCerrar={() => setCerrandoSesion(false)}
      />
    </div>
  );
}

/**
 * Una fila de la tarjeta de opciones.
 *
 * No reutiliza `ListRow` porque aquella obliga a pintar un avatar en cada fila,
 * y aquí lo que va a la izquierda es un icono.
 *
 * OJO CON EL FOCO. El anillo del sistema es una sombra que sobresale 4px
 * (`globals.css:220-224`) y la tarjeta que envuelve la lista lleva
 * `overflow-hidden`, así que se lo recorta. Se cambia por un contorno hacia
 * dentro, que no se puede recortar. Es exactamente lo que ya hace
 * `ListRow.tsx:42-45`, y por el mismo motivo.
 */
function FilaOpcion({
  icono,
  onClick,
  children,
}: {
  icono: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full cursor-pointer items-center gap-3 border-b border-border px-[18px] py-3.5 text-left text-[15px] text-text transition-colors last:border-b-0 hover:bg-surface-2 focus-visible:shadow-none focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-3px]"
    >
      <span className="shrink-0 text-text-muted">{icono}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight
        size={18}
        strokeWidth={1.5}
        aria-hidden
        className="shrink-0 text-text-muted"
      />
    </button>
  );
}

function CuentaCargando() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Card>
        <div className="flex items-center gap-4">
          <span className="size-14 shrink-0 animate-pulse rounded-full bg-surface-2" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="h-5 w-40 animate-pulse rounded bg-surface-2" />
            <span className="h-6 w-32 animate-pulse rounded-full bg-surface-2" />
          </div>
        </div>
      </Card>
      <Card padding={false}>
        <div className="flex flex-col">
          <span className="h-12 border-b border-border" />
          <span className="h-12" />
        </div>
      </Card>
    </div>
  );
}

/**
 * La sesión se ha ido mientras esta pantalla estaba abierta — por ejemplo
 * porque han dado de baja a esa persona, o porque cambió su contraseña en otro
 * dispositivo. El middleware redirige en la siguiente navegación, no ahora, así
 * que aquí hace falta una salida y no una pantalla en blanco.
 */
function SinSesion() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <LogOut size={22} strokeWidth={1.5} className="text-text-subtle" aria-hidden />
        <h2 className="text-[15px] font-semibold text-text">
          Tu sesión ha terminado
        </h2>
        <p className="max-w-[280px] text-[13px] text-text-muted">
          Vuelve a entrar para seguir usando el CRM.
        </p>
        <Link
          href="/login"
          className="mt-2 inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-5 text-[15px] font-medium text-text transition-colors hover:bg-surface-2"
        >
          Ir al acceso
        </Link>
      </div>
    </Card>
  );
}
