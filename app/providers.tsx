"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { TemaDelSistema } from "@/components/shell/TemaDelSistema";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Falta NEXT_PUBLIC_CONVEX_URL. Ejecuta `npx convex dev` una vez para crear el proyecto y escribir el .env.local.",
  );
}

const convex = new ConvexReactClient(convexUrl);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {/* Repone el `data-theme` que el remontaje de desarrollo borra, y sigue
          al sistema mientras la aplicación está abierta. No pinta nada. */}
      <TemaDelSistema />
      {children}
    </ConvexAuthNextjsProvider>
  );
}
