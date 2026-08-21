import { PorConstruir } from "@/components/ui/PorConstruir";

export default function VentasPage() {
  return (
    <PorConstruir
      pantalla="Ventas y oportunidades"
      descripcion="Las cifras En marcha y Ganado, filtro por estado con contadores, y el listado de operaciones. Tocar una operación abre la ficha de su cliente."
      lineas="líneas 350–409 (marcado) · 1251–1278 (listado y sumas)"
      issues={["JES-65", "JES-66", "JES-67"]}
    />
  );
}
