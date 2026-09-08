"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
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
 * ¿Este error del servidor va en el campo del correo?
 *
 * El alta y la edición NO dan el mismo mensaje, y ahí estaba el fallo: buscar
 * la palabra «email» acertaba con «Ya hay alguien con ese email»
 * (`users.ts#crearUsuario`) y fallaba con «Ya hay otra persona en el equipo
 * con…» (`helpers.ts#asignarEmail`, que es por donde pasa la edición). El
 * duplicado quedaba rechazado igual —eso nunca estuvo en duda—, pero se
 * anunciaba en un aviso suelto en vez de junto al campo que hay que corregir.
 *
 * Esta es la lista de lo que el servidor dice sobre un correo. Si allí cambia
 * un mensaje, hay que tocar aquí: es el precio de que el servidor mande y de no
 * inventarse un protocolo de códigos de error solo para esto.
 */
const ERRORES_DE_CORREO = [
  "ya hay otra persona en el equipo con",
  "ya hay alguien con ese email",
  "introduce un email válido",
];

function esErrorDeCorreo(mensaje: string): boolean {
  const m = mensaje.toLowerCase();
  return ERRORES_DE_CORREO.some((e) => m.includes(e));
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
      // El servidor es quien decide si el correo está repetido, y su mensaje se
      // enseña EN EL CAMPO: es donde está el problema, no en una alerta suelta.
      const mensaje =
        e instanceof Error ? e.message : "No se ha podido guardar";
      if (esErrorDeCorreo(mensaje)) {
        setErrorServidor(mensaje);
      } else {
        mostrarError(mensaje);
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
