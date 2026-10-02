---
name: conectar-zernio
description: |
  Conecta WhatsApp, Instagram DM y Facebook Messenger de un cliente a una instancia de
  Builder CRM a traves de Zernio: credenciales, webhook por API, cuentas, prueba de punta
  a punta y diagnostico. Activar cuando el usuario dice: conecta WhatsApp, conecta
  Instagram/Messenger, configura Zernio, no entran mensajes, el webhook no funciona.
allowed-tools: Read, Edit, Bash, Grep
---

# Conectar canales via Zernio

> Instancia / canal: $ARGUMENTS

Zernio es el proveedor por defecto: una API y un webhook para los tres canales. Meta
Cloud API directo existe como conector parcial (`src/lib/channels/conectores/README.md`)
y no es este flujo.

## 1. Credenciales (del cliente o de la agencia)

| Variable | Donde |
|---|---|
| `ZERNIO_API_KEY` | zernio.com -> Settings -> API Keys |
| `ZERNIO_PROFILE_ID` | `npm run zernio:setup` las lista; vacio = perfil Default |
| `ZERNIO_WEBHOOK_SECRET` | lo inventas (`openssl rand -hex 32`); va en la instancia Y en la suscripcion |

Cargarlas en Coolify (runtime) y redesplegar, o en `.env.local` si es local.

## 2. Webhook (por API, no a mano)

```bash
ZERNIO_API_KEY=... ZERNIO_WEBHOOK_SECRET=... npm run zernio:webhook -- --url https://<dominio>
```

El script busca la suscripcion por nombre y hace PUT si ya existe (Zernio no valida
URLs duplicadas: sin esto cada corrida duplica entregas). `--test` manda un evento de
prueba. Sin `--url` lista las suscripciones con su contador de fallos.

**Trampa**: si `ZERNIO_WEBHOOK_SECRET` no es identico en la instancia y en Zernio, el
endpoint responde 401 y los mensajes "no llegan" sin ningun error visible en el CRM.
**Trampa 2**: 10 fallos de entrega seguidos (por ejemplo un deploy roto que devolvio
500) y Zernio apaga la suscripcion: volver a correr el script la reactiva.

## 3. Conectar cuentas

- **Instagram / Messenger**: Ajustes -> Canales -> Conectar (popup OAuth de Meta). Al
  volver, `npm run zernio:setup -- --sync` o el boton "Sincronizar cuentas" deja la
  fila en `channel_accounts`.
- **WhatsApp**: elegir el modo ANTES de conectar.
  - *Coexistencia* (`business_app`, default): el numero sigue en la app WhatsApp
    Business del celular y lo que se contesta desde ahi tambien entra al CRM.
  - *Solo Cloud API* (`api`): el numero sale del celular. Un numero que esta en la app
    aparece como "no cumple los requisitos" en este modo (es el sintoma de haber
    elegido mal, no un problema del numero).
  - BYO-WABA sin navegador: `npm run zernio:whatsapp` con `WHATSAPP_ACCESS_TOKEN`,
    `WHATSAPP_BUSINESS_ACCOUNT_ID` y `WHATSAPP_PHONE_NUMBER_ID` del cliente.
- Historial previo: "Importar historial" en Ajustes -> Canales (no dispara el agente).

## 4. Probar de punta a punta

1. `GET /api/channels` (con sesion) -> el conector `zernio` aparece `configurado` y la
   cuenta esta `active`.
2. Enviar un mensaje real al numero/cuenta del cliente desde otro telefono.
3. En 2-10 segundos aparece en `/conversations`; si el agente esta encendido para ese
   canal (Ajustes -> Agente), responde en ~7 s.
4. Responder desde el chat: el mensaje sale y queda `sent`.

Instagram y Messenger arrancan con el agente **apagado**: encenderlos desde Ajustes ->
Agente despues de escribir su prompt (si no, usarian el de WhatsApp).

## Diagnostico

| Sintoma | Causa probable | Que mirar |
|---|---|---|
| No entran mensajes, sin errores | secreto desincronizado (401) o suscripcion apagada | `npm run zernio:webhook` (sin --url) muestra fallos; logs de Coolify buscando `firma invalida` |
| Entran pero el agente no contesta | agente apagado para el canal, contacto/hilo en pausa, falta `OPENROUTER_API_KEY` | Ajustes -> Agente; panel del chat; `/api/health` |
| Enviar falla con `TEMPLATE_REQUIRED` | WhatsApp fuera de la ventana de 24 h | mandar una plantilla aprobada (Plantillas) |
| Enviar falla 401/403 | `ZERNIO_API_KEY` invalida o cuenta desconectada | reconectar desde Ajustes -> Canales |
| Mensajes duplicados | dos suscripciones a la misma URL | `npm run zernio:webhook` lista y repunta; borrar la extra en Zernio |
