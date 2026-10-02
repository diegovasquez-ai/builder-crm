"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signIn, signUp } from "@/app/login/actions";

type Mode = "login" | "signup";

interface AuthFormProps {
  mode: Mode;
}

export function AuthForm({ mode }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const action = mode === "login" ? signIn : signUp;
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  const isSignup = mode === "signup";

  return (
    <form action={onSubmit} className="space-y-4">
      {isSignup && (
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Nombre y apellido"
            autoComplete="name"
            disabled={isPending}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@empresa.com"
          autoComplete="email"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contrasena</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder={isSignup ? "Minimo 6 caracteres" : "Tu contrasena"}
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={6}
          disabled={isPending}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-10 cursor-pointer"
        disabled={isPending}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {isSignup ? "Crear cuenta" : "Iniciar sesion"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? (
          <>
            Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground hover:text-primary"
            >
              Inicia sesion
            </Link>
          </>
        ) : (
          <>
            Aun no tienes cuenta?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground hover:text-primary"
            >
              Crea una
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
