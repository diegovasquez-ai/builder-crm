"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, UserPlus, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { avatarBg, getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "asesor";
  active: boolean;
}

const ROLE_ITEMS = [
  { value: "admin", label: "Administrador" },
  { value: "asesor", label: "Asesor" },
];

function label(m: Member) {
  return m.name?.trim() || m.email.split("@")[0];
}

/**
 * Equipo: quien esta, con que rol, y el alta de asesores. El signup publico esta
 * cerrado: la unica puerta de entrada es esta pantalla.
 */
export function TeamSettings() {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [list, current] = await Promise.all([
      fetch("/api/team").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/team/me").then((r) => (r.ok ? r.json() : { member: null })),
    ]);
    return { list, me: current.member as Member | null };
  }, []);

  const apply = useCallback((data: { list: Member[]; me: Member | null }) => {
    setMembers(data.list);
    setMe(data.me);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) apply(data);
    });
    return () => {
      alive = false;
    };
  }, [load, apply]);

  const isAdmin = me?.role === "admin";

  const update = async (id: string, patch: Partial<Member>) => {
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error ?? "No se pudo actualizar");
      return;
    }
    toast.success("Equipo actualizado");
    apply(await load());
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando equipo...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Los <strong>administradores</strong> ven todo y asignan contactos. Los{" "}
          <strong>asesores</strong> ven solo los contactos que tienen asignados.
        </p>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)} className="cursor-pointer shrink-0">
            <UserPlus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      <div className="rounded-lg border divide-y">
        {members.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-center gap-3 p-3",
              !m.active && "opacity-50"
            )}
          >
            <div
              className={cn(
                "h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold",
                avatarBg(label(m))
              )}
            >
              {getInitials(label(m))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {label(m)}
                {me?.id === m.id && (
                  <span className="text-xs text-muted-foreground font-normal"> (tu)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>

            {isAdmin ? (
              <Select
                value={m.role}
                items={ROLE_ITEMS}
                onValueChange={(v) => v && v !== m.role && update(m.id, { role: v as Member["role"] })}
              >
                <SelectTrigger className="h-8 w-[120px] text-xs cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="asesor">Asesor</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={m.role === "admin" ? "default" : "outline"} className="text-xs">
                {m.role === "admin" ? (
                  <>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Admin
                  </>
                ) : (
                  "Asesor"
                )}
              </Badge>
            )}

            {isAdmin && me?.id !== m.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update(m.id, { active: !m.active })}
                className="cursor-pointer h-8 px-2"
                title={m.active ? "Desactivar" : "Reactivar"}
              >
                {m.active ? (
                  <UserX className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <UserCheck className="h-4 w-4 text-primary" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <AddMemberDialog
          open={open}
          onClose={() => setOpen(false)}
          onCreated={async () => apply(await load())}
        />
      )}
    </div>
  );
}

function AddMemberDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("asesor");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "No se pudo agregar");
        return;
      }
      toast.success(
        body.reusedAuthUser
          ? "Agregado. Ya tenia usuario: entra con su contrasena de siempre."
          : "Agregado. Pasale el email y la contrasena temporal."
      );
      setName("");
      setEmail("");
      setPassword("");
      setRole("asesor");
      onClose();
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar al equipo</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tm-name">Nombre</Label>
            <Input
              id="tm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como lo va a nombrar el agente"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tm-email">Email *</Label>
            <Input
              id="tm-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="asesor@empresa.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} items={ROLE_ITEMS} onValueChange={(v) => v && setRole(v as Member["role"])}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asesor">Asesor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-pass">Contrasena temporal</Label>
              <Input
                id="tm-pass"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min. 8 caracteres"
                autoComplete="off"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Se crea el usuario con esa contrasena. Si el email ya tenia cuenta, se
            reutiliza y la contrasena se ignora.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="cursor-pointer">
              {saving ? "Agregando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
