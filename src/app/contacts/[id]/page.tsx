import { db } from "@/db";
import { contacts, activities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ContactDetailClient } from "@/components/contacts/ContactDetail";
import { canAccessContact, getCurrentMember } from "@/lib/team";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await getCurrentMember();
  if (!member) redirect("/sin-acceso");

  const contactRows = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  const contact = contactRows[0];
  // Ajeno = inexistente, para no confirmar que existe.
  if (!contact || !canAccessContact(member, contact)) notFound();

  const contactActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.contactId, id))
    .orderBy(desc(activities.createdAt));

  return (
    <ContactDetailClient
      contact={contact as Parameters<typeof ContactDetailClient>[0]["contact"]}
      activities={contactActivities as Parameters<typeof ContactDetailClient>[0]["activities"]}
    />
  );
}
