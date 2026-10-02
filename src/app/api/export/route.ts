import { NextRequest } from "next/server";
import { db } from "@/db";
import { contacts, deals, pipelineStages } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { formatDate, formatCurrency } from "@/lib/constants";
import { SOURCE_LABELS } from "@/lib/constants";
import type { LeadSource } from "@/types";
import { ownerFilter } from "@/lib/team";
import { requireMember } from "@/lib/api-auth";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { member } = auth;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "contacts";
  const today = new Date().toISOString().split("T")[0];

  if (type === "contacts") {
    const allContacts = await db
      .select()
      .from(contacts)
      .where(ownerFilter(member))
      .orderBy(desc(contacts.createdAt));

    const headers = [
      "Nombre",
      "Email",
      "Telefono",
      "Empresa",
      "Fuente",
      "Score",
      "Notas",
      "Fecha de creacion",
    ];

    const rows = allContacts.map((c) => [
      c.name,
      c.email || "",
      c.phone || "",
      c.company || "",
      SOURCE_LABELS[c.source as LeadSource] || c.source,
      String(c.score),
      c.notes || "",
      formatDate(c.createdAt),
    ]);

    const csv = buildCSV(headers, rows);

    return new Response("\ufeff" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contactos-${today}.csv"`,
      },
    });
  }

  if (type === "deals") {
    const allDeals = await db
      .select({
        title: deals.title,
        value: deals.value,
        probability: deals.probability,
        notes: deals.notes,
        expectedClose: deals.expectedClose,
        createdAt: deals.createdAt,
        contactName: contacts.name,
        stageName: pipelineStages.name,
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(ownerFilter(member))
      .orderBy(asc(pipelineStages.order));

    const headers = [
      "Titulo",
      "Valor",
      "Contacto",
      "Etapa",
      "Probabilidad",
      "Cierre Estimado",
      "Notas",
      "Fecha de creacion",
    ];

    const rows = allDeals.map((d) => [
      d.title,
      formatCurrency(d.value),
      d.contactName || "",
      d.stageName || "",
      `${d.probability}%`,
      formatDate(d.expectedClose),
      d.notes || "",
      formatDate(d.createdAt),
    ]);

    const csv = buildCSV(headers, rows);

    return new Response("\ufeff" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deals-${today}.csv"`,
      },
    });
  }

  return new Response("Tipo invalido. Use ?type=contacts o ?type=deals", {
    status: 400,
  });
}
