# Conectores de canal

Un **conector** es por donde viaja un mensaje. La bandeja, el agente y Ajustes solo
conocen la interfaz `Conector` (`../conector.ts`): `enviar`, `webhook` y `estado`.

| Conector | Archivo | Canales | Estado |
|---|---|---|---|
| Zernio | `zernio.ts` | WhatsApp, Instagram, Messenger | Completo. Camino normal. |
| Meta Cloud API (directo) | `meta-cloud.ts` | WhatsApp | Parcial: `enviar` + `estado`. La ingesta vive en la ruta legacy `/api/webhooks/whatsapp`. |
| Simulador | `simulador.ts` | todos (de prueba) | Guarda en vez de enviar; para demos y autoverificacion. |

## Como fluye un mensaje

- **Sale**: `deliverMessage` (`../deliver.ts`) resuelve el conector por
  `conversations.provider`, inserta la fila `pending`, llama a `enviar` y marca
  `sent`/`failed`. Nadie mas sale a la red.
- **Entra**: `POST /api/webhooks/<conector>` llama a `manejarWebhook(conector, req)`
  (`../webhook.ts`): verifica la firma con `webhook.verificar`, reclama el evento en
  `webhook_events` con `webhook.idEvento` (o el hash del cuerpo), responde 2xx y en
  `after()` corre `webhook.procesar`, que normaliza y persiste con `../ingest.ts`
  (`findOrCreateContactByIdentity`, `upsertConversation`, `ingestMessage`,
  `updateMessageStatus`). `GET` con `AGENT_WORKER_SECRET` barre lo que quedo colgado.
- **Estado**: `GET /api/channels` devuelve `estado()` de cada conector.

## Agregar el conector de la API oficial de WhatsApp (Cloud API / Tech Provider)

No esta implementado a proposito (brief, requisito 3). Cuando toque:

1. **Completar `meta-cloud.ts`** (o crear `cloud-api.ts` con `id: "meta"`):
   - `webhook.verificar`: `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`
     (`verifyWebhookSignature` de `src/lib/meta-whatsapp.ts` ya lo hace).
   - `webhook.idEvento`: el `wamid` del mensaje o el `id` del status; `null` si no hay
     (el nucleo usa el hash del cuerpo).
   - `webhook.procesar`: recorrer `entry[].changes[].value.messages[]` y `statuses[]`,
     resolver la cuenta por `metadata.phone_number_id` (`whatsapp_accounts`), y llamar
     a las funciones de `../ingest.ts`. La logica de referencia esta en
     `src/app/api/webhooks/whatsapp/route.ts` (`handleInboundMessage`,
     `handleStatusUpdate`): migrarla aqui y dejar esa ruta como
     `manejarWebhook(metaCloud, req)` mas el `GET` de verificacion del hub
     (`hub.challenge`).
2. **Conexion desde la UI**: Embedded Signup de Meta (o pegar token + ids) que escriba
   en `whatsapp_accounts`; hoy existe solo `scripts/connect-whatsapp-account.ts`.
3. **Registrar**: ya esta en `index.ts`. Si se crea otro id, agregar el valor a
   `PROVIDERS` en `../types.ts`.
4. **Tech Provider**: la instancia del cliente recibe su token desde la plataforma de la
   agencia; el webhook se enruta con `override_callback_uri` por WABA hacia
   `https://<instancia>/api/webhooks/whatsapp`. Mismo conector, otra forma de obtener
   credenciales.
5. **Probar**: `probar-instancia` ya cubre bandeja, agente y pipeline con el simulador;
   para Cloud API, mandar un mensaje real al numero de prueba y ver que entra.

Nada de esto toca la bandeja ni el agente: hablan con `Conector`, no con Meta.

## Reglas

- Credenciales por entorno (`ZERNIO_*`, `WHATSAPP_*`), nunca en codigo.
- El modulo del conector importa solo lo liviano a nivel de modulo; la ingesta y el
  cliente HTTP se importan dinamicamente (Zernio exige 2xx en 5 s).
- Un conector nunca escribe en `messages` directo: devuelve `SendOutcome` y deja que
  `deliverMessage` persista.
