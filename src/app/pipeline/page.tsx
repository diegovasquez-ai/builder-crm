import { db } from "@/db";
import { pipelines, pipelineStages, deals, contacts } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentMember, ownerFilter } from "@/lib/team";
import { countDocumentsByContact } from "@/lib/documents";
import { PipelineWorkspace } from "@/components/pipeline/PipelineWorkspace";
import type { Pipeline, DealWithContact } from "@/types";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const member = await getCurrentMember();
  if (!member) redirect("/sin-acceso");

  const allPipelines = await db
    .select()
    .from(pipelines)
    .orderBy(asc(pipelines.order));

  const allStages = await db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order));

  const dealRows = await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      stageId: deals.stageId,
      contactId: deals.contactId,
      expectedClose: deals.expectedClose,
      probability: deals.probability,
      notes: deals.notes,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      contactName: contacts.name,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    // Un asesor ve solo las operaciones de sus contactos.
    .where(ownerFilter(member));

  const docCounts = await countDocumentsByContact([...new Set(dealRows.map((d) => d.contactId))]);

  const pipelinesWithStages: Pipeline[] = allPipelines.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    order: p.order,
    stages: allStages.filter((s) => s.pipelineId === p.id),
  }));

  const dealsForClient: DealWithContact[] = dealRows.map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    stageId: d.stageId,
    contactId: d.contactId,
    expectedClose: d.expectedClose,
    probability: d.probability,
    notes: d.notes,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    contactName: d.contactName,
    docCount: docCounts[d.contactId] ?? 0,
  }));

  return (
    <PipelineWorkspace
      pipelines={pipelinesWithStages}
      deals={dealsForClient}
    />
  );
}
