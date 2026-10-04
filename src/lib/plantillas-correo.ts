import { marca, textoSobre } from "@/lib/config";

/**
 * Las dos plantillas de correo de acceso, con la marca de la instancia.
 *
 * Las sirve `/correo/[plantilla].html` y las lee el servidor de autenticacion, que es
 * quien manda el correo: en `GOTRUE_MAILER_TEMPLATES_*` se pone esa URL y GoTrue la
 * descarga, reemplaza sus marcadores y envia. Si la URL no responde, GoTrue usa su
 * plantilla por defecto (en ingles): se ve peor, pero el correo sale igual.
 *
 * En Supabase cloud las plantillas se pegan a mano en el panel (Auth -> Emails). La
 * misma URL sirve para eso: se abre, se copia el HTML y se pega.
 *
 * Los marcadores con llaves dobles los reemplaza GoTrue, no React: `ConfirmationURL` es
 * el enlace de un solo uso y `Email` el destinatario. No agregar otros marcadores sin
 * revisar que GoTrue los defina para ese tipo de correo; uno inexistente se imprime como
 * texto raro en el correo.
 *
 * Se escribe en HTML de correo a proposito (tablas, estilos en linea, sin CSS externo ni
 * variables): es lo unico que renderizan igual Gmail, Outlook y Apple Mail.
 */

export const PLANTILLAS = ["invitacion", "recuperacion"] as const;
export type TipoPlantilla = (typeof PLANTILLAS)[number];

export function esPlantilla(valor: string): valor is TipoPlantilla {
  return (PLANTILLAS as readonly string[]).includes(valor);
}

interface Texto {
  titulo: (marca: string) => string;
  entrada: string;
  boton: string;
  nota: string;
}

const TEXTOS: Record<TipoPlantilla, Texto> = {
  invitacion: {
    titulo: (m) => `Te sumaron a ${m}`,
    entrada:
      "Ya tenes tu lugar en el equipo. Solo falta que elijas una contrasena para entrar.",
    boton: "Elegir mi contrasena",
    nota: "Si no esperabas esta invitacion, podes ignorar este correo: sin definir la contrasena, la cuenta no se usa.",
  },
  recuperacion: {
    titulo: (m) => `Volver a entrar a ${m}`,
    entrada:
      "Pediste recuperar el acceso. Este enlace te deja elegir una contrasena nueva.",
    boton: "Elegir una contrasena nueva",
    nota: "Si no pediste esto, ignora el correo: tu contrasena actual sigue funcionando y nadie entro.",
  },
};

/** HTML de la plantilla. `base` es la URL publica de la instancia (para el logo). */
export function plantillaCorreo(tipo: TipoPlantilla, base: string | null): string {
  const m = marca();
  const t = TEXTOS[tipo];
  const sobrePrimario = textoSobre(m.colorPrimario);
  const logo = base ? `${base}${m.logo}` : null;

  const cabecera = logo
    ? `<img src="${logo}" width="44" height="44" alt="" style="display:block;border:0;border-radius:50%;margin:0 auto 14px" />`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapar(t.titulo(m.nombre))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(t.entrada)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.08);">
<tr><td style="height:4px;background:${m.colorPrimario};line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 32px 8px;text-align:center;">
${cabecera}
<h1 style="margin:0;font-size:20px;line-height:1.3;color:#101828;font-weight:600;">${escapar(t.titulo(m.nombre))}</h1>
</td></tr>
<tr><td style="padding:12px 32px 0;">
<p style="margin:0;font-size:15px;line-height:1.6;color:#475467;">${escapar(t.entrada)}</p>
</td></tr>
<tr><td style="padding:24px 32px 8px;" align="center">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:${m.colorPrimario};color:${sobrePrimario};font-size:15px;font-weight:600;text-decoration:none;">${escapar(t.boton)}</a>
</td></tr>
<tr><td style="padding:8px 32px 0;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#98a2b3;">Si el boton no funciona, copia este enlace en el navegador:<br /><a href="{{ .ConfirmationURL }}" style="color:#667085;word-break:break-all;">{{ .ConfirmationURL }}</a></p>
</td></tr>
<tr><td style="padding:20px 32px 28px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#98a2b3;">${escapar(t.nota)} El enlace sirve una sola vez y vence en 24 horas.</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#98a2b3;">${escapar(m.nombre)} &middot; enviado a {{ .Email }}</p>
</td></tr>
</table>
</body>
</html>
`;
}

/** La marca la escribe el miembro en config/cliente.ts, no un desconocido, pero esto
 *  igual va escapado: un `&` o un `<` en el nombre no debe romper el correo. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
