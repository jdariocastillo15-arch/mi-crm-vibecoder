import { PorConstruir } from "@/components/ui/PorConstruir";

export default function HoyPage() {
  return (
    <PorConstruir
      pantalla="Hoy — tareas del día"
      descripcion="Cabecera con la fecha y el recuento, panel de cuatro acciones rápidas, y los seguimientos agrupados en Atrasados, Para hoy y Próximas. El titular cuenta solo atrasados y de hoy."
      lineas="líneas 119–175 (marcado) · 985–1015 (secciones) · 1280–1289 (acciones rápidas)"
      issues={["JES-56", "JES-57", "JES-58"]}
    />
  );
}
