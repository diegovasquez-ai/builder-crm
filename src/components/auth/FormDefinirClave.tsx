"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Estado = "verificando" | "listo" | "invalido" | "guardado";

const MINIMO = 8;

/**
 * Donde aterriza quien hace clic en un correo de acceso (invitacion o recuperacion):
 * elige su contrasena y entra.
 *
 * El enlace del correo pasa primero por el servidor de autenticacion, que lo canjea y
 * nos devuelve aca con la sesion en el fragmento de la URL. Por eso esto corre en el
 * navegador: el fragmento no llega al servidor, nunca. Lo primero que hace es guardar la
 * sesion y limpiar la barra de direcciones, para que el enlace no quede a la vista ni en
 * el historial.
 *
 * Tambien acepta un codigo por query (flujo PKCE), que es lo que usa Supabase cloud
 * cuando la recuperacion se pide desde el mismo navegador.
 */
export function FormDefinirClave() {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [motivo, setMotivo] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;

    async function abrirSesion(): Promise<{ email?: string | null; error?: string | null }> {
      const fragmento = new URLSearchParams(window.location.hash.replace("#", ""));
      const query = new URLSearchParams(window.location.search);
      const descripcion = fragmento.get("error_description") ?? query.get("error_description");
      const codigo = query.get("code");
      const access = fragmento.get("access_token");
      const refresh = fragmento.get("refresh_token");

      // El token sale de la URL antes que nada: con la sesion ya en las cookies, dejarlo
      // en la barra solo sirve para que se filtre en una captura o en el historial.
      window.history.replaceState({}, "", window.location.pathname);

      if (descripcion) return { error: descripcion };

      const supabase = createClient();
      if (access && refresh) {
        const { error: fallo } = await supabase.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
        if (fallo) return { error: fallo.message };
      } else if (codigo) {
        const { error: fallo } = await supabase.auth.exchangeCodeForSession(codigo);
        if (fallo) return { error: fallo.message };
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) return { error: null };
      return { email: data.user.email ?? null };
    }

    abrirSesion()
      .then((r) => {
        if (!vivo) return;
        if (r.error !== undefined) {
          setMotivo(explicar(r.error));
          setEstado("invalido");
          return;
        }
        setEmail(r.email ?? null);
        setEstado("listo");
      })
      .catch((err: unknown) => {
        if (!vivo) return;
        setMotivo(explicar(err instanceof Error ? err.message : null));
        setEstado("invalido");
      });

    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (clave.length < MINIMO) {
      setError("La contrasena necesita al menos " + MINIMO + " caracteres.");
      return;
    }
    if (clave !== repetida) {
      setError("Las dos contrasenas no coinciden.");
      return;
    }
    setGuardando(true);
    const { error: fallo } = await createClient().auth.updateUser({ password: clave });
    if (fallo) {
      setError(fallo.message);
      setGuardando(false);
      return;
    }
    setEstado("guardado");
    // Recarga completa a proposito: el servidor tiene que ver las cookies nuevas para
    // resolver la membresia y armar el menu lateral.
    window.location.assign("/");
  }

  if (estado === "verificando") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Comprobando el enlace...
      </p>
    );
  }

  if (estado === "invalido") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {motivo}
        </div>
        <p className="text-sm text-muted-foreground">
          Los enlaces de acceso valen una sola vez y vencen a las 24 horas. Pedi uno nuevo
          o que te lo reenvie un administrador.
        </p>
        <Button render={<Link href="/auth/recuperar" />} className="w-full h-10">
          Pedir un enlace nuevo
        </Button>
      </div>
    );
  }

  if (estado === "guardado") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        Listo, entrando...
      </p>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      {email && (
        <p className="text-sm text-muted-foreground">
          Vas a entrar como <span className="font-medium text-foreground">{email}</span>.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="clave">Tu contrasena</Label>
        <Input
          id="clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder={"Minimo " + MINIMO + " caracteres"}
          autoComplete="new-password"
          minLength={MINIMO}
          required
          disabled={guardando}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="repetida">Repetila</Label>
        <Input
          id="repetida"
          type="password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          placeholder="La misma"
          autoComplete="new-password"
          required
          disabled={guardando}
        />
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full h-10 cursor-pointer" disabled={guardando}>
        {guardando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Guardar y entrar
      </Button>
    </form>
  );
}

/**
 * Los mensajes del proveedor vienen en ingles: se traducen los dos que de verdad pasan y
 * el resto se deja pasar tal cual, para no esconder informacion a quien va a pedir ayuda.
 */
function explicar(mensaje: string | null | undefined): string {
  if (!mensaje) return "Abri el enlace del correo otra vez: esta pagina sola no alcanza.";
  const m = mensaje.toLowerCase();
  if (m.includes("expired")) return "El enlace vencio.";
  if (m.includes("invalid") || m.includes("already")) return "El enlace ya se uso.";
  return mensaje.replace(/\+/g, " ");
}
