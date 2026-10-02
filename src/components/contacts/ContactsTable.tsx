"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Users, Download, Plus, X } from "lucide-react";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { avatarBg, getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Contact } from "@/types";
import { camposContacto, getConfig } from "@/lib/config";
import { formatearValorCampo } from "@/lib/config/campos";

interface ContactsTableProps {
  contacts: Contact[];
  onChange?: () => void;
}

function smartDate(input: number | Date): string {
  const date = new Date(input);
  const days = differenceInDays(new Date(), date);
  if (days < 7) {
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  }
  return format(date, "d MMM yyyy", { locale: es });
}

export function ContactsTable({ contacts, onChange }: ContactsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const columnasExtra = camposContacto().filter((c) => c.enTabla);
  const { moneda } = getConfig();

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      (c.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
      Object.values(c.customFields ?? {}).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  });

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No hay contactos"
        description="Agrega tu primer contacto para comenzar a gestionar tu pipeline de ventas."
        actionLabel="Agregar contacto"
        onAction={() => router.push("/contacts?new=true")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nombre, email, teléfono, etiqueta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/api/export?type=contacts")}
          className="cursor-pointer h-9"
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar
        </Button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/60">
              <TableHead className="bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Nombre
              </TableHead>
              <TableHead className="hidden sm:table-cell bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Teléfono
              </TableHead>
              <TableHead className="hidden md:table-cell bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Empresa
              </TableHead>
              {columnasExtra.map((c) => (
                <TableHead
                  key={c.clave}
                  className="hidden md:table-cell bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground"
                >
                  {c.etiqueta}
                </TableHead>
              ))}
              <TableHead className="hidden md:table-cell bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Asesor
              </TableHead>
              <TableHead className="bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Etiquetas
              </TableHead>
              <TableHead className="hidden lg:table-cell bg-muted/30 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Creado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer hover:bg-muted/40 border-border/50"
                onClick={() => router.push(`/contacts/${contact.id}`)}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold",
                        avatarBg(contact.name),
                      )}
                    >
                      {getInitials(contact.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.email || "Sin email"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {contact.phone || (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {contact.company || (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                {columnasExtra.map((c) => (
                  <TableCell key={c.clave} className="hidden md:table-cell text-sm">
                    {formatearValorCampo(c, contact.customFields?.[c.clave], moneda)}
                  </TableCell>
                ))}
                <TableCell className="hidden md:table-cell text-sm">
                  {contact.ownerName || contact.ownerEmail ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold",
                          avatarBg(contact.ownerName || contact.ownerEmail || "")
                        )}
                      >
                        {getInitials(contact.ownerName || contact.ownerEmail || "")}
                      </span>
                      <span className="truncate max-w-[120px]">
                        {contact.ownerName || contact.ownerEmail?.split("@")[0]}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <TagsCell contact={contact} onChange={onChange} />
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {smartDate(contact.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface TagsCellProps {
  contact: Contact;
  onChange?: () => void;
}

function TagsCell({ contact, onChange }: TagsCellProps) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const persist = async (next: string[]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) throw new Error();
      onChange?.();
      router.refresh();
    } catch {
      toast.error("No se pudo guardar las etiquetas");
      setTags(contact.tags ?? []);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = draft.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setDraft("");
      return;
    }
    const next = [...tags, t];
    setTags(next);
    setDraft("");
    void persist(next);
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    void persist(next);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-40">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-medium"
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-[11px] text-muted-foreground">
          +{tags.length - 3}
        </span>
      )}
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Editar etiquetas"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
            />
          }
        >
          <Plus className="h-3 w-3" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="space-y-2">
            <p className="text-xs font-medium">Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Sin etiquetas
                </span>
              )}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Quitar ${tag}`}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Nueva etiqueta"
                className="h-8 text-xs"
                disabled={saving}
              />
              <Button
                size="sm"
                onClick={addTag}
                disabled={saving || !draft.trim()}
                className="h-8 cursor-pointer"
              >
                Add
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
