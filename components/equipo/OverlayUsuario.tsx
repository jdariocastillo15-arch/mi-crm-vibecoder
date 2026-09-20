"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Mail } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Overlay } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Field";
import { Chips } from "@/components/ui/Chips";
import { useToast } from "@/components/ui/Toast";
import { AVISOS, ROL, type RolUsuario } from "@/lib/constants";
import { esEmailValido } from "@/lib/format";
import type { Persona } from "./ListaEquipo";

/**
 * Alta y edición de una persona del equipo — implementa JES-69.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 630–644.
 *
 * UN SOLO formulario para las dos cosas: solo cambia el título y si viene
 * relleno o vacío. Que sean el mismo componente no es ahorro de código, es que
 * son el mismo formulario — si un día se separan, se separan los dos campos y
 * las dos validaciones con ellos.
 *
 * EL ALTA ES CORTA, y lo es gracias a JES-92: crea la ficha y ya está. Esa
 * persona entra, pone su correo, y el login le manda el código para elegir
 * contraseña. Aquí no se crean credenciales ni se generan códigos.
 *
 * El aviso por correo va DESPUÉS y por separado, porque si falla el alta sigue
 * siendo válida: esa persona puede entrar igual, y lo que hay que hacer es
 * decírselo a quien la ha dado de alta, no fingir que ha fallado todo.
 */

/**
 * Qué se le dice a la persona según el motivo que manda el servidor — JES-97.
 *
 * LOS TEXTOS VIVEN AQUÍ, no en el servidor, porque **el mensaje de un `Error`
 * no llega al navegador en producción**: Convex lo sustituye por «Server
 * Error». Lo que sí viaja es el `data` de un `ConvexError`, y por ahí llega el
 * motivo.
 *
 * Aquí antes había una lista de CADENAS que se comparaba contra el mensaje del
 * servidor. Reconocía los dos textos del duplicado —el del alta y el de la
 * edición, que son distintos— y por eso parecía correcta, pero en producción no
 * hay mensaje que comparar: la lista no acertaba ninguno y el duplicado, que
 * seguía rechazándose, se anunciaba en un aviso suelto en vez de junto al campo
 * que hay que corregir. Con el motivo no hay nada que comparar, y el servidor
 * puede redactar lo que quiera sin romper esta pantalla.
 *
 * La lista equivalente está en `convex/users.ts`. No se comparte un módulo a
 * propósito: importar desde `convex/` traería al navegador todo el servidor.
 */
const TEXTO_POR_MOTIVO: Record<string, string> = {
  email_duplicado: "Ya hay alguien con ese email",
  email_invalido: "Introduce un email válido",
  ultima_duena: "El equipo no puede quedarse sin nadie que lo lleve",
};

/**
 * Los que van JUNTO al campo del correo, porque es ahí donde está el problema y
 * donde se corrige. `ultima_duena` NO entra: eso no se arregla tocando el
 * correo, sino el rol, así que va en el aviso general.
 */
const MOTIVOS_DEL_CAMPO = new Set(["email_duplicado", "email_invalido"]);

/**
 * Para todo lo demás: un motivo que no reconozcamos, o una excepción que no sea
 * nuestra —de la red, de la librería—. Nunca un texto inventado.
 */
const GENERICO = "No se ha podido guardar";

/** El motivo que viaja en el `data`, si es que lo hay. */
function motivoDe(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const datos = error.data as { motivo?: unknown } | null | undefined;
  if (datos === null || typeof datos !== "object") return null;
  return typeof datos.motivo === "string" ? datos.motivo : null;
}

const OPCIONES_ROL: { valor: RolUsuario; etiqueta: string }[] = [
  { valor: "comercial", etiqueta: ROL.comercial },
  { valor: "propietaria", etiqueta: ROL.propietaria },
];

export function OverlayUsuario({
  abierto,
  onCerrar,
  /** `null` = alta. Con persona = edición, y precarga sus datos. */
  persona,
}: {
  abierto: boolean;
  onCerrar: () => void;
  persona: Persona | null;
}) {
  const crear = useMutation(api.users.crearUsuario);
  const actualizar = useMutation(api.users.actualizarUsuario);
  const avisar = useAction(api.equipo.avisarDeAlta);
  const { mostrar, mostrarError } = useToast();

  const editando = persona !== null;

  const [nombre, setNombre] = useState(persona?.name ?? "");
  const [email, setEmail] = useState(persona?.email ?? "");
  // Al dar de alta se empieza en "Atiende y vende": el rol que manda es la
  // excepción, no lo que se reparte por descuido.
  const [rol, setRol] = useState<RolUsuario>(persona?.rol ?? "comercial");
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /** Lo que dijo el servidor sobre el correo — el duplicado, sobre todo. */
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const nombreLimpio = nombre.trim();
  // La misma forma canónica que usa el servidor. Ver `convex/helpers.ts`.
  const correo = email.trim().toLowerCase();

  const errorNombre = !nombreLimpio ? "Indica un nombre" : null;
  const errorEmail = !esEmailValido(correo)
    ? "Introduce un email válido"
    : errorServidor;

  async function guardar() {
    setIntentado(true);
    setErrorServidor(null);
    if (errorNombre || !esEmailValido(correo)) return;

    setGuardando(true);
    try {
      if (editando) {
        await actualizar({
          usuarioId: persona._id,
          name: nombreLimpio,
          email: correo,
          rol,
        });
        mostrar(AVISOS.usuarioActualizado);
        onCerrar();
        return;
      }

      const { usuarioId } = await crear({
        name: nombreLimpio,
        email: correo,
        rol,
      });

      // A partir de aquí la persona YA está dada de alta y puede entrar. Lo que
      // queda es cortesía, así que un fallo se cuenta sin deshacer nada.
      const { enviado } = await avisar({ usuarioId }).catch(() => ({
        enviado: false,
      }));

      mostrar(
        enviado
          ? AVISOS.usuarioAnadido
          : `${AVISOS.usuarioAnadido}, pero no se ha podido enviar el aviso`,
      );
      onCerrar();
    } catch (e) {
      // Lo del correo se enseña EN EL CAMPO, que es donde se corrige; lo demás,
      // en un aviso. Lo decide el MOTIVO, no el texto del servidor, que en
      // producción no llega.
      const motivo = motivoDe(e);
      // La clave se comprueba como PROPIA: una búsqueda a secas encuentra
      // también lo heredado de `Object.prototype`, y un motivo llamado
      // `toString` devolvería una función, que no es nula y se colaría.
      const texto =
        motivo !== null && Object.hasOwn(TEXTO_POR_MOTIVO, motivo)
          ? TEXTO_POR_MOTIVO[motivo]
          : GENERICO;

      if (motivo !== null && MOTIVOS_DEL_CAMPO.has(motivo)) {
        setErrorServidor(texto);
      } else {
        mostrarError(texto);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Overlay
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? "Editar usuario" : "Añadir usuario"}
      onGuardar={guardar}
      guardando={guardando}
    >
      <Input
        label="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoCapitalize="words"
        placeholder="Nombre y apellidos"
        error={intentado ? errorNombre : null}
      />

      <Input
        label="Email"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          // Lo que dijo el servidor era sobre el correo anterior.
          setErrorServidor(null);
        }}
        autoCapitalize="none"
        placeholder="nombre@empresa.es"
        icon={<Mail size={16} strokeWidth={1.5} />}
        error={intentado ? errorEmail : errorServidor}
      />

      {/* Sin `permitirVaciar`: siempre hay un rol. Nadie está en el equipo sin
          serlo de algo. */}
      <Chips
        label="Rol"
        opciones={OPCIONES_ROL}
        valor={rol}
        onChange={(v) => v && setRol(v)}
      />

      {!editando && (
        <p className="text-[13px] text-text-muted">
          Le llegará un aviso por correo. Para entrar, solo tiene que poner su
          email en la pantalla de acceso: el código se lo mandamos ahí.
        </p>
      )}
    </Overlay>
  );
}
