"use server";

import { correoDeAccesoActivo, enviarEnlaceDeAcceso } from "@/lib/auth-correo";

/**
 * Pide el correo con el enlace para volver a entrar.
 *
 * Responde lo mismo exista o no la cuenta: si dijera "ese correo no esta registrado",
 * cualquiera podria averiguar quien trabaja en la empresa probando direcciones. El limite
 * de frecuencia lo pone el servidor de autenticacion, que es el que manda el correo.
 */
export async function pedirEnlaceDeAcceso(
  formData: FormData
): Promise<{ ok?: true; error?: string }> {
  if (!correoDeAccesoActivo()) {
    return { error: "Esta instancia no manda correos: pedile el acceso a un administrador." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Escribi un email valido." };
  }

  const { error } = await enviarEnlaceDeAcceso(email);
  if (error) {
    // Los limites de frecuencia si se cuentan: sin esto, la persona vuelve a apretar el
    // boton pensando que no paso nada.
    const m = error.toLowerCase();
    if (m.includes("rate") || m.includes("security purposes") || m.includes("seconds")) {
      return { error: "Ya se mando uno hace poco. Espera un minuto y volve a intentar." };
    }
    return { error };
  }
  return { ok: true };
}
