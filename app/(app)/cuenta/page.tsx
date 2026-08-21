import { PorConstruir } from "@/components/ui/PorConstruir";

export default function CuentaPage() {
  return (
    <PorConstruir
      pantalla="Mi cuenta"
      descripcion="Avatar, nombre y rol; editar mis datos; cambiar contraseña; y cerrar sesión con confirmación."
      lineas="líneas 410–441 (marcado) · 1210–1238 (perfil y contraseña)"
      issues={["JES-48", "JES-49"]}
    />
  );
}
