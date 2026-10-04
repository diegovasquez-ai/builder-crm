"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { pedirEnlaceDeAcceso } from "@/app/auth/recuperar/actions";

/** Formulario de "olvide mi contrasena". Solo se muestra si la instancia manda correos. */
export function FormRecuperar() {
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await pedirEnlaceDeAcceso(formData);
      if (r.error) setError(r.error);
      else setEnviado(true);
    });
  }

  if (enviado) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
          <MailCheck className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
          <p className="text-muted-foreground">
            Si ese correo tiene cuenta, ya salio el enlace. Revisa tambien el correo no
            deseado: vence en 24 horas.
          </p>
        </div>
        <Button render={<Link href="/login" />} variant="outline" className="w-full h-10">
          Volver al inicio de sesion
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Tu email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@empresa.com"
          autoComplete="email"
          required
          disabled={pendiente}
        />
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full h-10 cursor-pointer" disabled={pendiente}>
        {pendiente && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Mandame el enlace
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:text-primary">
          Volver
        </Link>
      </p>
    </form>
  );
}
