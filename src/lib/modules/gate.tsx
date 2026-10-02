import { notFound } from "next/navigation";
import { moduloActivo } from "@/lib/config";

/**
 * Layout de servidor para las funciones del nucleo apagables por config
 * (`modulos.nucleo`): si esta apagada, la ruta responde 404 y no aparece en el menu.
 *
 *   // src/app/automatizaciones/layout.tsx
 *   export default gateLayout("automatizaciones");
 */
export function gateLayout(nombre: string) {
  return function GateLayout({ children }: { children: React.ReactNode }) {
    if (!moduloActivo(nombre)) notFound();
    return <>{children}</>;
  };
}
