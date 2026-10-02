import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reportes } from "@/components/reportes/Reportes";
import { getCurrentMember } from "@/lib/team";
import { generarReporte, RANGOS, type RangoDias } from "@/lib/reportes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reportes",
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/sin-acceso");

  const { dias: param } = await searchParams;
  const dias: RangoDias = (RANGOS as readonly number[]).includes(Number(param)) ? (Number(param) as RangoDias) : 30;

  const reporte = await generarReporte(member, dias);

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle={
          member.role === "admin"
            ? "Numeros reales de toda la instancia"
            : "Numeros reales de tus contactos"
        }
      />
      <Reportes reporte={reporte} />
    </div>
  );
}
