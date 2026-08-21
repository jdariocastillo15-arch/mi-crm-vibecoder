import { PorConstruir } from "@/components/ui/PorConstruir";

export default function ClientesPage() {
  return (
    <PorConstruir
      pantalla="Clientes"
      descripcion="Buscador en vivo por nombre, empresa, email y teléfono; contador; lista con último contacto y etiqueta de estado. Más los tres estados de carga y vacío."
      lineas="líneas 176–225 (marcado) · 972–983 (filtrado)"
      issues={["JES-50", "JES-51", "JES-52"]}
    />
  );
}
