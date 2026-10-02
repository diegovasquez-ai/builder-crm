"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hayMiembros } from "@/lib/team";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contrasena son requeridos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

/**
 * El registro publico esta abierto SOLO mientras no exista ningun miembro: la primera
 * cuenta de una instancia nueva queda como administrador (trigger
 * `on_auth_user_created`) y despues el registro se cierra solo. Los asesores se crean
 * desde Ajustes -> Equipo. `ALLOW_PUBLIC_SIGNUP=true` lo deja abierto siempre.
 */
export async function registroAbierto(): Promise<boolean> {
  if (process.env.ALLOW_PUBLIC_SIGNUP === "true") return true;
  return !(await hayMiembros());
}

export async function signUp(formData: FormData) {
  if (!(await registroAbierto())) {
    return {
      error:
        "El registro esta cerrado. Pide a un administrador que te agregue al equipo.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password) {
    return { error: "Email y contrasena son requeridos." };
  }
  if (password.length < 8) {
    return { error: "La contrasena debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || null },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      error:
        "Cuenta creada. Revisa tu email para confirmar antes de iniciar sesion.",
    };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
