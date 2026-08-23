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
 *
 * Aquí NO se crean cuentas. Las crea la Dueña desde la pantalla de Equipo
 * (JES-69). El registro está cerrado en el servidor, en `convex/auth.ts`; esta
 * pantalla simplemente no ofrece lo que ya no se puede hacer.
 */
export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorEmail =
    intentado && !esEmailValido(email) ? "Introduce un email válido" : null;
  const errorPassword =
    intentado && password.trim().length === 0 ? "Introduce tu contraseña" : null;
  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    setIntentado(true);
    setError(null);

    if (!esEmailValido(email) || password.trim().length === 0) return;

    setCargando(true);
    try {
      await signIn("password", { email: email.trim(), password, flow: "signIn" });
      router.push("/hoy");
    } catch {
      setError("Email o contraseña incorrectos");
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
              Inicia sesión
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
                autoComplete="current-password"
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
              Entrar
            </Button>
          </form>
        </div>

      </div>
    </main>
  );
}
