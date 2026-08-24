"use client";

import { useId } from "react";
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Campos de formulario — implementa parte de JES-41.
 *
 * Tres reglas que no se negocian:
 * · La etiqueta va SIEMPRE asociada al control (`htmlFor`/`id`), no es un texto suelto encima.
 * · El error se anuncia con texto, no solo con color, y va ligado al campo con `aria-describedby`.
 * · Alto de 48px: el área táctil cómoda de Carlos, que usa esto con una mano.
 */

const CONTROL_BASE =
  "w-full rounded-md border bg-surface text-[15px] text-text placeholder:text-text-subtle transition-colors disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-subtle";

function estadoBorde(error?: string | null) {
  return error
    ? "border-error focus:border-error"
    : "border-border-strong focus:border-primary";
}

function Envoltura({
  id,
  label,
  error,
  helper,
  accion,
  children,
}: {
  id: string;
  label?: string;
  error?: string | null;
  helper?: string;
  /** Control opcional a la derecha de la etiqueta, como "+ Nuevo cliente". */
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {(label || accion) && (
        <div className="flex min-h-6 items-center justify-between gap-2">
          {label ? (
            <label htmlFor={id} className="text-sm font-medium text-text">
              {label}
            </label>
          ) : (
            <span />
          )}
          {accion}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-error-text">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-[13px] text-text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label?: string;
  error?: string | null;
  helper?: string;
  icon?: ReactNode;
  /**
   * Control dentro del campo, pegado al borde derecho: el "X" de limpiar del
   * buscador de clientes (JES-50).
   *
   * Va aquí y no en la pantalla porque quien coloca el botón tiene que reservar
   * también su hueco, y las dos cosas no pueden vivir separadas. Si el
   * `padding` lo pusiera la pantalla por `className`, no ganaría de forma
   * fiable: `cn` es un `join` sin `tailwind-merge`, así que quedarían las dos
   * clases de `padding-right` y decidiría el orden del CSS.
   */
  accionInterior?: ReactNode;
}

export function Input({
  label,
  error,
  helper,
  icon,
  accionInterior,
  className,
  ...props
}: InputProps) {
  const id = useId();
  return (
    <Envoltura id={id} label={label} error={error} helper={helper}>
      <div className="relative">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-subtle"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          {...props}
          className={cn(
            CONTROL_BASE,
            estadoBorde(error),
            "h-12",
            icon ? "pl-10" : "pl-3.5",
            accionInterior ? "pr-12" : "pr-3.5",
            className,
          )}
        />
        {accionInterior && (
          <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
            {accionInterior}
          </span>
        )}
      </div>
    </Envoltura>
  );
}

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label?: string;
  error?: string | null;
  helper?: string;
}

export function Textarea({ label, error, helper, className, ...props }: TextareaProps) {
  const id = useId();
  return (
    <Envoltura id={id} label={label} error={error} helper={helper}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
        {...props}
        className={cn(CONTROL_BASE, estadoBorde(error), "resize-y p-3.5 leading-body", className)}
      />
    </Envoltura>
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label?: string;
  error?: string | null;
  helper?: string;
  /**
   * Control a la derecha de la etiqueta. Lo pide "Nueva tarea" (JES-59), que
   * lleva un "+ Nuevo cliente" junto a "Cliente". Va aquí en vez de en un
   * control a medida para no volver a cablear `htmlFor` y `aria-describedby`.
   */
  accion?: ReactNode;
}

export function Select({
  label,
  error,
  helper,
  accion,
  className,
  children,
  ...props
}: SelectProps) {
  const id = useId();
  return (
    <Envoltura id={id} label={label} error={error} helper={helper} accion={accion}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          {...props}
          className={cn(
            CONTROL_BASE,
            estadoBorde(error),
            "h-12 cursor-pointer appearance-none pr-10 pl-3.5",
            className,
          )}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          size={18}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text-subtle"
        />
      </div>
    </Envoltura>
  );
}
