import { PorConstruir } from "@/components/ui/PorConstruir";

export default function FichaClientePage() {
  return (
    <PorConstruir
      pantalla="Ficha de cliente"
      descripcion="Cuatro bloques: cabecera con teléfono y email accionables, acciones rápidas, seguimientos pendientes e historial unificado (interacciones + ventas + seguimientos completados, en una sola línea de tiempo)."
      lineas="líneas 226–309 (marcado) · 1040–1058 (datos) · 959–971 (historial)"
      issues={["JES-53", "JES-54", "JES-61", "JES-64"]}
    />
  );
}
