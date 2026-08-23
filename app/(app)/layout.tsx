import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

/** Todas las pantallas con sesión viven dentro del armazón. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
