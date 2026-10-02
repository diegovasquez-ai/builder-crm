import { zernioFetch } from "./client";
import type { ZernioResult } from "./types";

/**
 * Plantillas de WhatsApp via Zernio (`/v1/whatsapp/templates`).
 *
 * La forma es practicamente la misma que la de Graph API (`name`, `language`,
 * `category`, `components`, `status`), asi que los helpers de
 * `src/lib/whatsapp-templates.ts` y la tabla `whatsapp_templates` se reusan tal cual;
 * lo unico que cambia es quien es el destinatario de la llamada.
 */

export interface ZernioTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | (string & {});
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY" | (string & {});
  language: string;
  components: unknown[];
}

export async function listTemplates(
  accountId: string
): Promise<ZernioResult<{ success?: boolean; templates: ZernioTemplate[] }>> {
  return zernioFetch<{ success?: boolean; templates: ZernioTemplate[] }>(
    "/whatsapp/templates",
    { query: { accountId } }
  );
}

export interface CreateTemplateInput {
  accountId: string;
  /** Meta exige minusculas, digitos y guion bajo: `^[a-z][a-z0-9_]*$`. */
  name: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  components: unknown[];
  parameterFormat?: "POSITIONAL" | "NAMED";
}

export async function createTemplate(
  input: CreateTemplateInput
): Promise<ZernioResult<{ id?: string; status?: string; name?: string }>> {
  return zernioFetch<{ id?: string; status?: string; name?: string }>(
    "/whatsapp/templates",
    { method: "POST", body: input }
  );
}

export async function deleteTemplate(
  accountId: string,
  templateName: string
): Promise<ZernioResult<{ success?: boolean }>> {
  return zernioFetch<{ success?: boolean }>(
    `/whatsapp/templates/${encodeURIComponent(templateName)}`,
    { method: "DELETE", query: { accountId } }
  );
}

/**
 * Conecta una WABA propia sin pasar por el browser (BYO-WABA).
 *
 * El numero y la cuenta siguen siendo del cliente: Zernio solo recibe credenciales
 * para operarla. Necesita un System User de Meta con permisos
 * `whatsapp_business_management` y `whatsapp_business_messaging`.
 */
export interface ConnectWhatsappInput {
  profileId?: string;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
}

export async function connectWhatsapp(
  input: ConnectWhatsappInput
): Promise<ZernioResult<{ accountId?: string; success?: boolean }>> {
  return zernioFetch<{ accountId?: string; success?: boolean }>(
    "/connect/whatsapp/credentials",
    { method: "POST", body: input }
  );
}
