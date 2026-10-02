"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { AutomationsList } from "@/components/automations/AutomationsList";

export default function AutomatizacionesPage() {
  return (
    <div>
      <PageHeader
        title="Automatizaciones"
        subtitle="Reglas que se ejecutan solas cuando pasa algo en el CRM"
      />
      <AutomationsList />
    </div>
  );
}
