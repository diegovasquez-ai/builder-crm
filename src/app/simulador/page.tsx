import { notFound, redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/team";
import { moduloActivo } from "@/lib/config";
import { Simulador } from "@/components/simulador/Simulador";

export const dynamic = "force-dynamic";

export const metadata = { title: "Simulador" };

/**
 * Simulador de conversaciones: solo admin. Un asesor recibe 404 (no se confirma que
 * exista), y con `modulos.nucleo.simulador = false` tampoco existe para nadie.
 */
export default async function SimuladorPage() {
  if (!moduloActivo("simulador")) notFound();
  const member = await getCurrentMember();
  if (!member) redirect("/sin-acceso");
  if (member.role !== "admin") notFound();

  return <Simulador />;
}
