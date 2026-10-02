"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { ContactForm } from "@/components/contacts/ContactForm";
import type { Contact } from "@/types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadContacts = () => {
    fetch("/api/contacts")
      .then((res) => res.json())
      .then((data) => {
        setContacts(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCloseForm = () => {
    setShowForm(false);
    loadContacts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-heading">
            Contactos
          </h1>
          <p className="text-xs text-muted-foreground">
            {contacts.length}{" "}
            {contacts.length === 1 ? "contacto" : "contactos"}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="cursor-pointer">
          <Plus className="h-4 w-4" />
          Nuevo contacto
        </Button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <ContactsTable contacts={contacts} onChange={loadContacts} />
      )}

      <ContactForm open={showForm} onClose={handleCloseForm} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-9 w-full max-w-md rounded bg-muted animate-pulse" />
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
        <div className="h-12 bg-muted/30 border-b border-border/60" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-14 border-b border-border/40 last:border-b-0 px-4 flex items-center"
          >
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
            <div className="ml-3 flex-1 space-y-1.5">
              <div className="h-3 w-40 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-56 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
