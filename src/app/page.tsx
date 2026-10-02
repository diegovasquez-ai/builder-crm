import { redirect } from "next/navigation";
import { db } from "@/db";
import { contacts, deals, activities, pipelineStages } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { getCurrentMember, ownerFilter } from "@/lib/team";
import { serieContactos } from "@/lib/reportes";
import { KPICards } from "@/components/dashboard/KPICards";
import { PipelineChart } from "@/components/dashboard/PipelineChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import { PageHeader } from "@/components/layout/PageHeader";
import { CargarDemo } from "@/components/dashboard/CargarDemo";
import type { DashboardStats } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/sin-acceso");

  // Un asesor ve solo sus contactos y lo que cuelga de ellos; el admin ve todo.
  const soloMios = ownerFilter(member);

  const allContacts = await db.select().from(contacts).where(soloMios);
  const allDeals = await db
    .select({
      id: deals.id,
      value: deals.value,
      stageId: deals.stageId,
    })
    .from(deals)
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .where(soloMios);
  const stages = await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order));

  const activeDeals = allDeals.filter((d) => {
    const stage = stages.find((s) => s.id === d.stageId);
    return stage && !stage.isWon && !stage.isLost;
  });

  const wonDeals = allDeals.filter((d) => {
    const stage = stages.find((s) => s.id === d.stageId);
    return stage?.isWon;
  });

  const stats: DashboardStats = {
    totalContacts: allContacts.length,
    activeDeals: activeDeals.length,
    totalPipelineValue: activeDeals.reduce((sum, d) => sum + d.value, 0),
    wonDealsValue: wonDeals.reduce((sum, d) => sum + d.value, 0),
    conversionRate:
      allDeals.length > 0
        ? Math.round((wonDeals.length / allDeals.length) * 100)
        : 0,
  };

  const pipelineData = stages
    .filter((s) => !s.isLost)
    .map((stage) => ({
      name: stage.name,
      count: allDeals.filter((d) => d.stageId === stage.id).length,
      value: allDeals
        .filter((d) => d.stageId === stage.id)
        .reduce((sum, d) => sum + d.value, 0),
      color: stage.color,
    }));

  const contactos7d = await serieContactos(member, 7);

  const recentActivities = await db
    .select({
      id: activities.id,
      type: activities.type,
      description: activities.description,
      contactName: contacts.name,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .innerJoin(contacts, eq(activities.contactId, contacts.id))
    .where(soloMios)
    .orderBy(desc(activities.createdAt))
    .limit(5);

  const isFirstRun = allContacts.length === 0 && allDeals.length === 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen de tu pipeline de ventas"
      />

      <div className="space-y-5">
      {isFirstRun && (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-6">
          <h2 className="text-lg font-semibold tracking-tight font-heading mb-2">
            Todo listo para empezar
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Todavia no hay contactos. Tres caminos para arrancar:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3.5 rounded-xl bg-card border border-border/60">
              <p className="font-medium">1. Conecta un canal</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configuracion → Canales: WhatsApp, Instagram o Messenger
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/60">
              <p className="font-medium">2. Agrega contactos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Desde Contactos, a mano o importando un CSV
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/60">
              <p className="font-medium">3. Carga datos de demostracion</p>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Contactos, conversaciones y operaciones inventados para ver el CRM lleno.
              </p>
              {member.role === "admin" && <CargarDemo />}
            </div>
          </div>
        </div>
      )}

      <NotificationBanner />

      <KPICards stats={stats} contactos={contactos7d} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <PipelineChart data={pipelineData} />
        </div>
        <div>
          <RecentActivity
            activities={
              recentActivities as Array<{
                id: string;
                type: string;
                description: string;
                contactName: string | null;
                createdAt: number | Date;
              }>
            }
          />
        </div>
      </div>
      </div>
    </div>
  );
}
