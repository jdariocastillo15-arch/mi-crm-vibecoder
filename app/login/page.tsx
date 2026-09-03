"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Logo } from "@/components/shell/AppShell";
import { esEmailValido } from "@/lib/format";

/**
 * Inicio de sesión — implementa JES-46 y JES-83.
 * Diseño: DESING/design_handoff_crm_pwa/CRM Shell.dc.html, líneas 32–65.
 *
 * Dos puertas: Google y la contraseña de siempre. Los errores del formulario
 * solo aparecen tras el primer intento de enviar, no mientras se escribe:
 * validar cada tecla es hostil con quien todavía está escribiendo.
 *
 * Aquí NO se crean cuentas, por ninguna de las dos puertas. Los perfiles los
 * crea la Dueña (JES-69) y el registro está cerrado en el servidor, en
 * `convex/auth.ts`: entrar con Google exige que ese correo ya sea un usuario
 * del CRM. Esta pantalla simplemente no ofrece lo que ya no se puede hacer.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  // El aviso de un intento de Google fallido llega ya decidido desde el
  // servidor, así que se pinta en el primer render. A partir de ahí es un error
  // más de la pantalla: cualquier intento nuevo lo limpia.
  const [error, setError] = useState<string | null>(() =>
    avisoDeVueltaDeGoogle(use(searchParams)),
  );

  const errorEmail =
    intentado && !esEmailValido(email) ? "Introduce un email válido" : null;
  const errorPassword =
    intentado && password.trim().length === 0 ? "Introduce tu contraseña" : null;

  /**
   * Entrar por Google no navega solo. El proveedor de Convex Auth canjea el
   * `code` que trae la URL, guarda la sesión y borra el parámetro, pero deja al
   * usuario donde estaba: aquí, ya autenticado, mirando el formulario. Esta es
   * la navegación que falta. Sirve también para quien vuelva a /login con la
   * sesión abierta.
   */
  useEffect(() => {
    if (isAuthenticated) router.replace("/hoy");
  }, [isAuthenticated, router]);

  async function entrarConGoogle() {
    setError(null);
    setCargandoGoogle(true);
    try {
      await signIn("google", { redirectTo: "/login?google=1" });
      // Si todo va bien, el navegador ya se ha ido a Google y esto no sigue.
    } catch {
      // Aquí solo se llega si la llamada falla ANTES de salir hacia Google:
      // en la práctica, un despliegue sin AUTH_GOOGLE_ID o AUTH_GOOGLE_SECRET.
      setError(
        "No se ha podido conectar con Google. Avisa a quien administre el CRM.",
      );
      setCargandoGoogle(false);
    }
  }

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

          <Button
            type="button"
            variant="secondary"
            fullWidth
            loading={cargandoGoogle}
            disabled={cargando}
            onClick={entrarConGoogle}
            iconLeft={<IconoGoogle />}
          >
            Continuar con Google
          </Button>

          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="text-[13px] text-text-subtle">o</span>
            <span className="h-px flex-1 bg-border" />
          </div>

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

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={cargando}
              disabled={cargandoGoogle}
            >
              Entrar
            </Button>
          </form>
        </div>

      </div>
    </main>
  );
}

/**
 * ¿Google nos ha devuelto con las manos vacías?
 *
 * Cuando el servidor rechaza el acceso, la librería redirige de vuelta SIN
 * `code` y sin ningún mensaje (`implementation/index.ts`, el catch del
 * callback): el rechazo se vería como un botón que no hizo nada. El marcador
 * `google=1` que va en el `redirectTo` permite distinguir los dos casos — con
 * `code` es un login en curso, y el proveedor lo está canjeando; sin él, es un
 * rechazo o una cancelación.
 *
 * Lo lee el servidor, de los `searchParams` de la propia página, y no el
 * navegador con `useSearchParams`: así el aviso viaja en el HTML inicial, no
 * hace falta envolver la pantalla en <Suspense>, y no depende de llegar a
 * mirar la URL antes de que el proveedor borre el `code` de ella.
 */
function avisoDeVueltaDeGoogle(params: {
  [key: string]: string | string[] | undefined;
}): string | null {
  if (params.google !== "1" || params.code !== undefined) return null;
  return "No se ha podido entrar con Google. Puede que hayas cancelado, o que esa cuenta no esté dada de alta en el CRM.";
}

/**
 * La "G" de Google, en SVG y con sus colores de marca.
 *
 * Va inline y no como icono de `lucide-react` a propósito: la biblioteca no
 * trae logos de marca, y las normas de Google para este botón piden su logo
 * tal cual, sin recolorear. Por eso es lo único de esta pantalla que no usa los
 * tokens del design system.
 */
function IconoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
