import { notFound, redirect } from "next/navigation";
import { moduloActivo } from "@/lib/config";
import { getCurrentMember } from "@/lib/team";

/**
 * Layout de servidor para las funciones del nucleo apagables por config
 * (`modulos.nucleo`): si esta apagada, la ruta responde 404 y no aparece en el menu.
 *
 *   // src/app/automatizaciones/layout.tsx
 *   export default gateLayout("automatizaciones");
 *
 * Ademas exige membresia, porque estas paginas son componentes de cliente: sin esto se
 * renderizaban para cualquiera con sesion de Auth, aunque no estuviera en el equipo.
 * Primero la bandera y despues la membresia: una funcion apagada responde 404 para
 * todos, que es lo que se espera de algo que no existe en esta instancia.
 */
export function gateLayout(nombre: string) {
  return async function GateLayout({ children }: { children: React.ReactNode }) {
    if (!moduloActivo(nombre)) notFound();
    const member = await getCurrentMember();
    if (!member) redirect("/sin-acceso");
    return <>{children}</>;
  };
}
