import { redirect } from "next/navigation";

/** La aplicación abre en "Hoy". */
export default function Home() {
  redirect("/hoy");
}
