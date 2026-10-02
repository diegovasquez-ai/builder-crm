/**
 * Cliente de Zernio (https://docs.zernio.com) — proveedor unificado de mensajeria para
 * Instagram DM, Facebook Messenger y WhatsApp.
 *
 * Se usa `fetch` a mano y no el SDK `@zernio/node` por tres razones:
 *  - los 4 integradores externos del repo (meta-whatsapp, ghl, tokko, firecrawl) son
 *    fetch a mano con el mismo contrato de retorno; un SDK rompe la convencion;
 *  - el SDK es pre-1.0 autogenerado y se publica casi por commit: un rename en la
 *    superficie generada rompe el build en un `npm i`;
 *  - la verificacion de firma necesita el raw body, o sea codigo propio igual.
 */

export {
  zernioFetch,
  hasZernioKey,
  getProfileId,
  zernioConfig,
  type ZernioFetchOptions,
} from "./client";

export {
  listConversations,
  iterateConversations,
  listMessages,
  sendMessage,
  createConversation,
  extractMessageId,
  type ListConversationsParams,
  type ListMessagesParams,
  type ListMessagesResponse,
  type CreateConversationInput,
  type ZernioTemplateRef,
  type SendMessageInput,
  type SendMessageResponse,
} from "./inbox";

export {
  listAccounts,
  getAccount,
  listProfiles,
  buildConnectUrl,
  connectWhatsappHeadless,
  accountIdOf,
  profileIdOf,
  type ConnectWhatsappCredentials,
} from "./accounts";

export {
  listTemplates,
  createTemplate,
  deleteTemplate,
  connectWhatsapp,
  type CreateTemplateInput,
  type ZernioTemplate,
} from "./whatsapp";

export {
  verifyZernioSignature,
  hasZernioWebhookSecret,
  SUBSCRIBED_EVENTS,
} from "./webhooks";

export type * from "./types";
