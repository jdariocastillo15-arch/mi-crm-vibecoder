import { PorConstruir } from "@/components/ui/PorConstruir";

export default function EquipoPage() {
  return (
    <PorConstruir
      pantalla="Equipo"
      descripcion="Lista de usuarios con rol, alta y edición, y borrado con las dos protecciones: no puedes eliminarte a ti misma ni dejar al equipo sin ninguna Dueña. Solo visible para la Dueña."
      lineas="líneas 310–349 (marcado) · 1183–1208 (lista y reglas)"
      issues={["JES-68", "JES-69", "JES-70"]}
    />
  );
}
