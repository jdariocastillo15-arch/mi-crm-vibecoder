import { PorConstruir } from "@/components/ui/PorConstruir";

export default function EquipoPage() {
  return (
    <PorConstruir
      pantalla="Equipo"
      descripcion="Lista de usuarios con rol, alta y edición, y borrado con las dos protecciones: no puedes eliminar tu propia cuenta ni dejar al equipo sin nadie que lo lleve. Solo visible para quien lleva el equipo."
      lineas="líneas 310–349 (marcado) · 1183–1208 (lista y reglas)"
      issues={["JES-68", "JES-69", "JES-70"]}
    />
  );
}
