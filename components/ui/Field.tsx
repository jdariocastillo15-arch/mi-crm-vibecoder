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
  children,
}: {
  id: string;
  label?: string;
  error?: string | null;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
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
}

export function Input({ label, error, helper, icon, className, ...props }: InputProps) {
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
            icon ? "pr-3.5 pl-10" : "px-3.5",
            className,
          )}
        />
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
}

export function Select({ label, error, helper, className, children, ...props }: SelectProps) {
  const id = useId();
  return (
    <Envoltura id={id} label={label} error={error} helper={helper}>
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
