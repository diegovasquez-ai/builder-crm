"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { OwnerSelect } from "./OwnerSelect";
import { CamposPersonalizadosInputs } from "./CamposPersonalizados";
import type { ValoresCampos } from "@/lib/config/campos";

const contactSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email invalido").or(z.literal("")),
  phone: z.string(),
  company: z.string(),
  source: z.string(),
  notes: z.string(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<ContactFormData> & {
    id?: string;
    tags?: string[];
    ownerId?: string | null;
    customFields?: Record<string, unknown> | null;
  };
}

export function ContactForm({ open, onClose, initialData }: ContactFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [camposValores, setCamposValores] = useState<ValoresCampos>(
    (initialData?.customFields as ValoresCampos | null) ?? {}
  );
  // Solo se manda si el admin lo toco: un asesor no puede cambiarlo y el servidor
  // rechaza el campo aunque venga con el mismo valor.
  const [ownerId, setOwnerId] = useState<string | null>(initialData?.ownerId ?? null);
  const [ownerDirty, setOwnerDirty] = useState(false);

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) {
      setTagDraft("");
      return;
    }
    setTags([...tags, t]);
    setTagDraft("");
  };
  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      company: initialData?.company || "",
      source: initialData?.source || "otro",
      notes: initialData?.notes || "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const url = isEditing
        ? `/api/contacts/${initialData!.id}`
        : "/api/contacts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          tags,
          customFields: camposValores,
          ...(ownerDirty ? { ownerId } : {}),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Error al guardar");
      }

      toast.success(
        isEditing ? "Contacto actualizado" : "Contacto creado"
      );
      reset();
      setTags([]);
      setTagDraft("");
      setCamposValores({});
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el contacto");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Contacto" : "Nuevo Contacto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" {...register("name")} placeholder="Nombre completo" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input id="phone" {...register("phone")} placeholder="+52 55 1234 5678" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input id="company" {...register("company")} placeholder="Nombre de la empresa" />
          </div>

          <div className="space-y-2">
            <Label>Fuente</Label>
            <Select
              value={watch("source")}
              onValueChange={(v) => v && setValue("source", v)}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">Sitio web</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="referido">Referido</SelectItem>
                <SelectItem value="redes_sociales">Redes sociales</SelectItem>
                <SelectItem value="llamada_fria">Llamada fria</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="formulario">Formulario</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="import">Importado</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1.5">
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
            <div className="flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Agregar etiqueta y presionar Enter"
                className="h-9"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addTag}
                disabled={!tagDraft.trim()}
                className="cursor-pointer h-9"
              >
                Agregar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Asesor a cargo</Label>
            <OwnerSelect
              value={ownerId}
              onChange={(v) => {
                setOwnerId(v);
                setOwnerDirty(true);
              }}
            />
          </div>

          <CamposPersonalizadosInputs
            valores={camposValores}
            onChange={setCamposValores}
            disabled={isSubmitting}
          />

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Notas sobre el contacto..." rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
