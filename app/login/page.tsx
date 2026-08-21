"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Logo } from "@/components/shell/AppShell";
import { esEmailValido } from "@/lib/format";

/**
 * Inicio de sesión — implementa JES-46.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 32–65.
 *
 * Los errores solo aparecen tras el primer intento de enviar, no mientras se
 * escribe: validar cada tecla es hostil con quien todavía está escribiendo.
 */
export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [modo, setModo] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorEmail =
    intentado && !esEmailValido(email) ? "Introduce un email válido" : null;
  const errorPassword =
    intentado && password.trim().length === 0 ? "Introduce tu contraseña" : null;
  const errorNombre =
    intentado && modo === "signUp" && nombre.trim().length === 0
      ? "Indica un nombre"
      : null;

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setIntentado(true);
    setError(null);

    if (!esEmailValido(email) || password.trim().length === 0) return;
    if (modo === "signUp" && nombre.trim().length === 0) return;

    setCargando(true);
    try {
      await signIn("password", {
        email: email.trim(),
        password,
        flow: modo,
        ...(modo === "signUp" ? { name: nombre.trim(), rol: "propietaria" } : {}),
      });
      router.push("/hoy");
    } catch {
      setError(
        modo === "signIn"
          ? "Email o contraseña incorrectos"
          : "No se ha podido crear la cuenta. ¿Ya existe ese email?",
      );
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-[22px]">
        <div className="flex items-center justify-center gap-2.5">
          <Logo size={34} />
          <span className="text-xl font-semibold text-text">Vibe CRM</span>
        </div>

        <div className="flex flex-col gap-[18px] rounded-xl border border-border bg-surface px-6 py-7 shadow-sm">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-text">
              {modo === "signIn" ? "Inicia sesión" : "Crea tu cuenta"}
            </h1>
            <p className="text-sm text-text-muted">
              Accede a tu CRM para gestionar clientes y seguimientos.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-error bg-error-bg px-3 py-2.5 text-[13px] font-medium text-error-text"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {modo === "signUp" && (
              <Input
                label="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellidos"
                autoCapitalize="words"
                error={errorNombre}
              />
            )}

            <Input
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
              icon={<Mail size={16} strokeWidth={1.5} />}
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errorEmail}
            />

            <div className="relative">
              <Input
                label="Contraseña"
                type={verPassword ? "text" : "password"}
                autoComplete={modo === "signIn" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errorPassword}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={verPassword}
                className="absolute top-[30px] right-1.5 inline-flex size-11 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-2"
              >
                {verPassword ? (
                  <EyeOff size={18} strokeWidth={1.5} aria-hidden />
                ) : (
                  <Eye size={18} strokeWidth={1.5} aria-hidden />
                )}
              </button>
            </div>

            <Button type="submit" variant="primary" fullWidth loading={cargando}>
              {modo === "signIn" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>
        </div>

        {/*
          ANDAMIO TEMPORAL — quitar cuando JES-69 resuelva cómo entra por primera
          vez alguien del equipo (invitación por email o contraseña provisional).
          De momento hace falta para poder crear la primera Dueña: el diseño no
          contempla registro, porque da por hecho que las cuentas las crea ella
          desde la pantalla de Equipo.
        */}
        <p className="text-center text-[13px] text-text-muted">
          {modo === "signIn" ? "¿Todavía no tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button
            type="button"
            onClick={() => {
              setModo(modo === "signIn" ? "signUp" : "signIn");
              setIntentado(false);
              setError(null);
            }}
            className="rounded-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {modo === "signIn" ? "Crear la primera cuenta" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </main>
  );
}
