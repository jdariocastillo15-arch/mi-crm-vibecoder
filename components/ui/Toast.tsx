"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Avisos — implementa JES-44.
 *
 * Cada alta del CRM se aplica al instante y se confirma con un aviso breve.
 * Uno de ellos, el de completar un seguimiento, permite deshacer: es la única
 * red de seguridad contra el toque accidental en una lista que se usa con el
 * pulgar.
 *
 * Sobre los textos: los mensajes de éxito viven en `AVISOS` (`lib/constants.ts`)
 * porque son copia del diseño y tienen que decirse igual en toda la aplicación.
 * Los errores NO están ahí y no deben estarlo: vienen del servidor, que es
 * quien sabe por qué ha fallado algo ("Lo completó otra persona"), y se enseñan
 * tal cual llegan. Duplicarlos en una constante obligaría a mantener dos veces
 * el mismo texto y a que el cliente adivinase cuál toca.
 */

const DURACION_CON_ACCION = 3_800;
const DURACION_SIN_ACCION = 2_600;

type Accion = { label: string; onClick: () => void };

type Aviso = {
  id: number;
  mensaje: string;
  accion?: Accion;
  tono: "neutral" | "error";
};

type ContextoAvisos = {
  mostrar: (mensaje: string, accion?: Accion) => void;
  mostrarError: (mensaje: string) => void;
};

const Contexto = createContext<ContextoAvisos | null>(null);

export function useToast() {
  const ctx = useContext(Contexto);
  if (ctx === null) {
    throw new Error("useToast necesita estar dentro de <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const siguienteId = useRef(0);

  const encolar = useCallback(
    (mensaje: string, accion: Accion | undefined, tono: Aviso["tono"]) => {
      // Si ya había uno visible, su temporizador se cancela aquí. Sin esto, el
      // reloj del aviso que se va mataría al que acaba de entrar.
      if (temporizador.current !== null) clearTimeout(temporizador.current);

      const id = ++siguienteId.current;
      setAviso({ id, mensaje, accion, tono });

      temporizador.current = setTimeout(
        () => {
          // Y aunque se colase un temporizador viejo, solo borra si el aviso
          // que hay delante sigue siendo el suyo.
          setAviso((actual) => (actual?.id === id ? null : actual));
        },
        accion ? DURACION_CON_ACCION : DURACION_SIN_ACCION,
      );
    },
    [],
  );

  const mostrar = useCallback(
    (mensaje: string, accion?: Accion) => encolar(mensaje, accion, "neutral"),
    [encolar],
  );

  const mostrarError = useCallback(
    (mensaje: string) => encolar(mensaje, undefined, "error"),
    [encolar],
  );

  useEffect(() => {
    return () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
    };
  }, []);

  function cerrar() {
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    setAviso(null);
  }

  const Icono = aviso?.tono === "error" ? TriangleAlert : Check;

  return (
    <Contexto.Provider value={{ mostrar, mostrarError }}>
      {children}

      {/* Fuera del flujo y siempre montado: el lector de pantalla lo anuncia
          sin que el aviso le robe el foco a nadie. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-21 z-[100] flex justify-center px-4 md:bottom-6"
      >
        {aviso && (
          <div
            className={cn(
              "pointer-events-auto flex w-full max-w-[440px] items-center gap-2.5",
              "rounded-xl px-4 py-3 shadow-lg animate-vibe-slide-up md:w-auto",
              aviso.tono === "error" ? "bg-error text-on-primary" : "bg-text text-bg",
            )}
          >
            <Icono size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
            <span className="flex-1 text-[15px]">{aviso.mensaje}</span>
            {aviso.accion && (
              <button
                type="button"
                onClick={() => {
                  aviso.accion?.onClick();
                  cerrar();
                }}
                className="shrink-0 rounded-md px-2 py-1 text-[15px] font-semibold underline underline-offset-2"
              >
                {aviso.accion.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}
