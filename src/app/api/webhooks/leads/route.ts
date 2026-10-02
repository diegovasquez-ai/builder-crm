import { NextRequest, NextResponse } from "next/server";
import { emitContactCreated } from "@/lib/contacts/events";
import { db } from "@/db";
import { contacts, activities, crmSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

// Field name mapping: common variations → standard field
const FIELD_MAP: Record<string, string> = {
  // Name
  name: "name",
  nombre: "name",
  full_name: "name",
  fullname: "name",
  first_name: "name",
  nombre_completo: "name",
  // Email
  email: "email",
  correo: "email",
  email_address: "email",
  correo_electronico: "email",
  // Phone
  phone: "phone",
  telefono: "phone",
  phone_number: "phone",
  cel: "phone",
  celular: "phone",
  whatsapp: "phone",
  movil: "phone",
  // Company
  company: "company",
  empresa: "company",
  company_name: "company",
  negocio: "company",
  organizacion: "company",
  // Notes
  notes: "notes",
  notas: "notes",
  message: "notes",
  mensaje: "notes",
  comments: "notes",
  comentarios: "notes",
  descripcion: "notes",
};

function extractFields(
  payload: Record<string, unknown>
): Record<string, string> {
  // Handle Typeform-style nested data
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, "_");
    const mappedField = FIELD_MAP[normalizedKey];
    if (mappedField && !result[mappedField]) {
      result[mappedField] = String(value).trim();
    }
  }

  // Handle "first_name + last_name" pattern
  if (!result.name) {
    const firstName =
      data.first_name || data.nombre || data.firstName || data.primer_nombre;
    const lastName =
      data.last_name || data.apellido || data.lastName || data.apellidos;
    if (firstName) {
      result.name = [firstName, lastName].filter(Boolean).join(" ").trim();
    }
  }

  return result;
}

/**
 * Webhook generico de leads: formularios, landings, Zapier/Make, Meta Lead Ads via un
 * intermediario... Publico por el prefijo /api/webhooks; se protege con
 * LEADS_WEBHOOK_SECRET (header `x-webhook-secret`). Si la variable esta vacia, se
 * acepta el secreto guardado en crm_settings (clave `webhook_secret`); sin ninguno de
 * los dos, el endpoint queda abierto (solo para pruebas).
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let secreto = process.env.LEADS_WEBHOOK_SECRET || "";
  if (!secreto) {
    const [stored] = await db
      .select()
      .from(crmSettings)
      .where(eq(crmSettings.key, "webhook_secret"))
      .limit(1);
    secreto = stored?.value ?? "";
  }

  if (secreto) {
    const secretHeader = request.headers.get("x-webhook-secret");
    if (!secretHeader || secretHeader !== secreto) {
      return NextResponse.json(
        { error: "Secret invalido o faltante" },
        { status: 401 }
      );
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const fields = extractFields(payload);

  if (!fields.name) {
    return NextResponse.json(
      {
        error: "Campo 'name' o 'nombre' es requerido",
        received: Object.keys(payload),
        hint: "Campos soportados: name, nombre, full_name, email, correo, phone, telefono, company, empresa, notes, notas, message",
      },
      { status: 400 }
    );
  }

  try {
    const now = new Date();
    const contactRows = await db
      .insert(contacts)
      .values({
        name: fields.name,
        email: fields.email || null,
        phone: fields.phone || null,
        company: fields.company || null,
        source: "webhook",
        score: 0,
        notes: fields.notes || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const contact = contactRows[0];

    await emitContactCreated(contact.id, { name: contact.name, source: "webhook" });

    // Log activity for the new lead
    await db.insert(activities).values({
      type: "note",
      description: `Lead recibido via webhook${fields.company ? ` (${fields.company})` : ""}`,
      contactId: contact.id,
      createdAt: now,
    });

    return NextResponse.json(
      {
        success: true,
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          source: contact.source,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error al crear contacto: ${error instanceof Error ? error.message : "Unknown"}`,
      },
      { status: 500 }
    );
  }
}
