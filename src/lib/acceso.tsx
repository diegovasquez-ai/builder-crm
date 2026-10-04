import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/team";

/**
 * Puerta de acceso para una pagina.
 *
 * Las paginas que son componentes de servidor resuelven el miembro ellas mismas y
 * redirigen. Las que son de cliente no pueden: se renderizan igual y el candado queda
 * solo en las rutas de API, asi que alguien con sesion de Auth pero sin fila en
 * `team_members` veia el armazon de la aplicacion en vez de `/sin-acceso`. No se
 * escapaba ningun dato, porque toda ruta de datos exige membresia, pero la puerta tiene
 * que ser la misma en todas.
 *
 * Uso, en un `layout.tsx` al lado de la pagina:
 *
 *   export default layoutSoloMiembros();
 *
 * Con `soloAdmin` ademas exige rol de administrador.
 */
export function layoutSoloMiembros(opciones: { soloAdmin?: boolean } = {}) {
  return async function Layout({ children }: { children: ReactNode }) {
    const member = await getCurrentMember();
    if (!member) redirect("/sin-acceso");
    if (opciones.soloAdmin && member.role !== "admin") redirect("/");
    return <>{children}</>;
  };
}
