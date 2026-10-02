import { zernioFetch, getProfileId } from "./client";
import type {
  ZernioAccount,
  ZernioListResponse,
  ZernioPlatform,
  ZernioProfile,
  ZernioResult,
} from "./types";

/** Cuentas sociales conectadas y flujos de conexion (OAuth y headless). */

export async function listAccounts(): Promise<
  ZernioResult<ZernioListResponse<ZernioAccount>>
> {
  return zernioFetch<ZernioListResponse<ZernioAccount>>("/accounts");
}

export async function getAccount(
  accountId: string
): Promise<ZernioResult<ZernioAccount>> {
  return zernioFetch<ZernioAccount>(
    `/accounts/${encodeURIComponent(accountId)}`
  );
}

export async function listProfiles(): Promise<
  ZernioResult<ZernioListResponse<ZernioProfile>>
> {
  return zernioFetch<ZernioListResponse<ZernioProfile>>("/profiles");
}

export interface ConnectUrlOptions {
  profileId?: string;
  /**
   * Solo WhatsApp. Define que pantalla muestra el Embedded Signup de Meta:
   *  - `api`: selector de WABA / numero. Es lo correcto para un numero que YA esta en
   *    Cloud API.
   *  - `business_app`: coexistencia, un numero compartido con la app WhatsApp Business.
   * Omitirlo NO es neutro: Meta cae en coexistencia por defecto.
   */
  onboarding?: "api" | "business_app";
  /**
   * Solo Instagram.
   *  - `instagram_login` (default): autoriza la cuenta profesional de Instagram
   *    directamente, SIN necesidad de una Pagina de Facebook.
   *  - `facebook_login`: pasa por una Pagina que tenga Instagram vinculado, y agrega un
   *    paso de seleccion de Pagina.
   */
  loginMethod?: "instagram_login" | "facebook_login";
}

/**
 * Paso 1 del flujo OAuth: pedir la URL de autorizacion.
 *
 * El servidor la pide y devuelve solo el `authUrl` al browser. La API key de Zernio
 * nunca sale del server.
 */
export async function buildConnectUrl(
  platform: ZernioPlatform,
  redirectUrl: string,
  options: ConnectUrlOptions = {}
): Promise<ZernioResult<{ authUrl: string; state?: string }>> {
  return zernioFetch<{ authUrl: string; state?: string }>(
    `/connect/${encodeURIComponent(platform)}`,
    {
      query: {
        profileId: options.profileId ?? getProfileId() ?? undefined,
        redirect_url: redirectUrl,
        // Coexistencia por defecto, igual que Zernio. Es el caso normal de un negocio
        // chico: el numero ya vive en la app WhatsApp Business de un celular y tiene
        // que seguir funcionando ahi. `api` deja el numero SOLO en Cloud API y lo saca
        // del telefono, asi que solo sirve si el numero ya estaba en Cloud API.
        ...(platform === "whatsapp"
          ? { onboarding: options.onboarding ?? "business_app" }
          : {}),
        ...(platform === "instagram"
          ? { loginMethod: options.loginMethod ?? "instagram_login" }
          : {}),
      },
    }
  );
}

export interface ConnectWhatsappCredentials {
  /** System User token permanente de Meta. */
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  profileId?: string;
}

/**
 * Conexion headless de una WABA propia (BYO-WABA), sin pasar por el browser.
 *
 * Es lo que permite migrar WhatsApp a Zernio sin comprar numero ni mover la WABA: el
 * numero y la cuenta siguen siendo del cliente, Zernio solo recibe credenciales para
 * operarla. Requiere un System User con `whatsapp_business_management` y
 * `whatsapp_business_messaging`.
 */
export async function connectWhatsappHeadless(
  creds: ConnectWhatsappCredentials
): Promise<ZernioResult<{ accountId?: string }>> {
  return zernioFetch<{ accountId?: string }>("/connect/whatsapp/credentials", {
    method: "POST",
    body: {
      profileId: creds.profileId ?? getProfileId() ?? undefined,
      accessToken: creds.accessToken,
      wabaId: creds.wabaId,
      phoneNumberId: creds.phoneNumberId,
    },
  });
}

/** Zernio devuelve el id de cuenta como `id` o `_id` segun endpoint. */
export function accountIdOf(account: ZernioAccount): string {
  return account.id ?? (account as unknown as { _id?: string })._id ?? "";
}

export function profileIdOf(profile: ZernioProfile): string {
  return profile._id ?? profile.id ?? "";
}
