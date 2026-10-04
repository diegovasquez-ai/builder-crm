"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, ShieldCheck, UserPlus, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { leerConfigPublica } from "@/lib/config-publica";
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

const ACCESO_ITEMS = [
  { value: "invitacion", label: "Invitacion por correo" },
  { value: "clave", label: "Contrasena temporal" },
];

type ModoAcceso = "invitacion" | "clave";

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
  // Si el servidor de autenticacion manda correos, el alta puede invitar; si no, la
  // unica via es una contrasena temporal que el admin pasa a mano.
  const { authEnviaCorreos } = leerConfigPublica();

  const reenviarAcceso = async (m: Member) => {
    const res = await fetch(`/api/team/${m.id}/acceso`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error ?? "No se pudo reenviar");
      return;
    }
    toast.success(`Enlace enviado a ${m.email}`);
  };

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

            {isAdmin && authEnviaCorreos && m.active && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reenviarAcceso(m)}
                className="cursor-pointer h-8 px-2"
                title="Reenviar el acceso por correo"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
              </Button>
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
          puedeInvitar={authEnviaCorreos}
        />
      )}
    </div>
  );
}

function CampoClaveTemporal({
  password,
  onChange,
}: {
  password: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="tm-pass">Contrasena temporal</Label>
      <Input
        id="tm-pass"
        type="text"
        value={password}
        onChange={(e) => onChange(e.target.value)}
        placeholder="opcional, min. 8 caracteres"
        autoComplete="off"
      />
      <p className="text-xs text-muted-foreground">
        Dejala vacia si la persona va a entrar con Google u otro proveedor.
      </p>
    </div>
  );
}

function AddMemberDialog({
  open,
  onClose,
  onCreated,
  puedeInvitar,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  puedeInvitar: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("asesor");
  const [modo, setModo] = useState<ModoAcceso>("invitacion");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const invitar = puedeInvitar && modo === "invitacion";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password, invitar }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "No se pudo agregar");
        return;
      }
      if (body.avisoCorreo) {
        toast.warning(`Agregado, pero el correo no salio: ${body.avisoCorreo}`);
      } else if (body.correoEnviado) {
        toast.success(`Invitado. Le llego un correo a ${email} para elegir su contrasena.`);
      } else {
        toast.success(
          body.reusedAuthUser
            ? "Agregado. Ya tenia usuario: entra con su contrasena de siempre."
            : "Agregado. Pasale el email y la contrasena temporal."
        );
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("asesor");
      setModo("invitacion");
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
          <DialogDescription>
            {invitar
              ? "Le llega un correo con un enlace para elegir su contrasena. Entra con eso, no hace falta que le pases nada."
              : "La cuenta queda lista al instante y no se envia ningun correo: pasale vos la contrasena temporal, o dejala vacia si va a entrar con un proveedor externo."}
          </DialogDescription>
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
              <p className="text-xs text-muted-foreground">
                {role === "asesor"
                  ? "Ve solo los contactos asignados a el, y sus conversaciones, operaciones y actividades."
                  : "Ve todo y gestiona equipo, canales, agente y automatizaciones."}
              </p>
            </div>
            {puedeInvitar ? (
              <div className="space-y-2">
                <Label>Como entra</Label>
                <Select
                  value={modo}
                  items={ACCESO_ITEMS}
                  onValueChange={(v) => v && setModo(v as ModoAcceso)}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invitacion">Invitacion por correo</SelectItem>
                    <SelectItem value="clave">Contrasena temporal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {invitar
                    ? "Le llega el enlace a ese email y elige su propia contrasena."
                    : "Se la pasas vos por donde quieras."}
                </p>
              </div>
            ) : (
              <CampoClaveTemporal password={password} onChange={setPassword} />
            )}
          </div>

          {puedeInvitar && !invitar && (
            <CampoClaveTemporal password={password} onChange={setPassword} />
          )}

          {!invitar && (
            <p className="text-xs text-muted-foreground">
              Se crea el usuario con esa contrasena. Si el email ya tenia cuenta, se
              reutiliza y la contrasena se ignora.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="cursor-pointer">
              {saving ? "Guardando..." : invitar ? "Invitar" : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
