import { Home, Users, TrendingUp, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RolUsuario } from "@/lib/constants";

/**
 * Los destinos de la aplicación — implementa parte de JES-42.
 *
 * Cuatro como máximo en la barra de pestañas, y "Equipo" solo existe para la
 * Dueña: un comercial ve tres. No hay Pipeline ni Catálogo — salieron del MVP.
 */
export interface Destino {
  href: string;
  label: string;
  icon: LucideIcon;
  soloPropietaria?: boolean;
}

export const DESTINOS: Destino[] = [
  { href: "/hoy", label: "Hoy", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/equipo", label: "Equipo", icon: Shield, soloPropietaria: true },
];

export function destinosPara(rol: RolUsuario | undefined): Destino[] {
  return DESTINOS.filter((d) => !d.soloPropietaria || rol === "propietaria");
}

/**
 * Rutas que se abren a pantalla completa: ocultan la barra de pestañas y
 * muestran botón de atrás.
 */
export function esPantallaCompleta(pathname: string): boolean {
  return /^\/clientes\/[^/]+$/.test(pathname) || pathname === "/cuenta";
}
