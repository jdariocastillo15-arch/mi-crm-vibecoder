"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ChevronLeft, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { destinosPara, esPantallaCompleta } from "./nav";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { ROL } from "@/lib/constants";
import { cn } from "@/lib/cn";

/**
 * Armazón de la aplicación — implementa JES-42.
 *
 * Móvil (menos de 768px): barra inferior de pestañas + barra superior con avatar.
 * Escritorio (768px o más): barra lateral de 240px + contenido centrado a 860px.
 *
 * La ficha de cliente y "Mi cuenta" ocultan la barra de pestañas y muestran
 * botón de atrás.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me);

  const destinos = destinosPara(me?.rol);
  const pantallaCompleta = esPantallaCompleta(pathname);
  const titulo = tituloDe(pathname, destinos);

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* ---- Barra lateral (escritorio) ---- */}
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-5 md:flex">
        <div className="flex items-center gap-2.5 px-3 pb-5">
          <Logo size={26} />
          <span className="text-base font-semibold text-text">Vibe CRM</span>
        </div>

        <nav className="flex flex-col gap-1">
          {destinos.map((d) => {
            const activo = pathname.startsWith(d.href);
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
                  activo
                    ? "bg-primary-subtle font-semibold text-primary"
                    : "font-medium text-text-muted hover:bg-surface-2",
                )}
              >
                <d.icon size={20} strokeWidth={1.5} aria-hidden />
                {d.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 border-t border-border pt-3">
          <Link
            href="/cuenta"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-surface-2"
          >
            <Avatar name={me?.name || "?"} size={32} variant="neutral" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium text-text">
                {me?.name || "…"}
              </span>
              <span className="text-xs text-text-subtle">
                {me?.rol ? ROL[me.rol] : ""}
              </span>
            </span>
          </Link>
          <IconButton
            aria-label="Cerrar sesión"
            size="compact"
            onClick={() => void signOut()}
          >
            <LogOut size={20} strokeWidth={1.5} aria-hidden />
          </IconButton>
        </div>
      </aside>

      {/* ---- Columna de contenido ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-10 flex h-15 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
          {pantallaCompleta && (
            <IconButton aria-label="Atrás" onClick={() => router.back()}>
              <ChevronLeft size={22} strokeWidth={1.5} aria-hidden />
            </IconButton>
          )}
          <h1 className="flex-1 truncate pl-1 text-[17px] font-semibold text-text">
            {titulo}
          </h1>
          {!pantallaCompleta && (
            <Link
              href="/cuenta"
              aria-label="Mi cuenta"
              className="shrink-0 rounded-full md:hidden"
            >
              <Avatar name={me?.name || "?"} size={32} variant="neutral" />
            </Link>
          )}
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[860px] px-4 pt-4 pb-8 md:px-8 md:pt-7 md:pb-14">
            {children}
          </div>
        </main>

        {/* ---- Barra de pestañas (móvil) ---- */}
        {!pantallaCompleta && (
          <nav
            aria-label="Navegación principal"
            className="flex shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            {destinos.map((d) => {
              const activo = pathname.startsWith(d.href);
              return (
                <Link
                  key={d.href}
                  href={d.href}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                    activo ? "font-semibold text-primary" : "font-medium text-text-subtle",
                  )}
                >
                  <d.icon size={22} strokeWidth={1.5} aria-hidden />
                  <span className="text-[11px]">{d.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

/** El cuadro verde con la "V". Es toda la marca que tiene el producto. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, borderRadius: size * 0.26, fontSize: size * 0.56 }}
      className="inline-flex shrink-0 items-center justify-center bg-primary font-semibold text-on-primary"
    >
      V
    </span>
  );
}

function tituloDe(pathname: string, destinos: { href: string; label: string }[]) {
  if (pathname === "/cuenta") return "Mi cuenta";
  if (/^\/clientes\/[^/]+$/.test(pathname)) return "Cliente";
  return destinos.find((d) => pathname.startsWith(d.href))?.label ?? "Vibe CRM";
}
