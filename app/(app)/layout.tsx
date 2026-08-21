import { AppShell } from "@/components/shell/AppShell";

/** Todas las pantallas con sesión viven dentro del armazón. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
