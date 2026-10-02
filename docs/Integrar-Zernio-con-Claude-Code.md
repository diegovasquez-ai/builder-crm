# Integrar Zernio en tu aplicación

**El prompt completo para que Claude Code lo construya bien la primera vez.**

---

## Qué es esto

Zernio es una API que unifica WhatsApp, Instagram DM, Facebook Messenger y una docena
más de plataformas detrás de un solo contrato: una API key, un webhook, una bandeja.
Te ahorra tratar con Meta directamente — sin App Review, sin Business Verification, sin
mantener tres integraciones distintas que se comportan distinto.

Lo que sigue no es documentación. Es el **prompt** que le pasas a Claude Code para que
construya la integración, con las restricciones que normalmente solo se aprenden después
de romper producción dos o tres veces.

**Cómo usarlo:** copia cada bloque en Claude Code, en orden. Cada uno deja algo que
funciona. Si tienes prisa, pega los ocho de una vez y déjalo trabajar.

**Sirve para cualquier stack.** Los ejemplos mencionan Next.js porque es donde está
construido, pero cada regla es de la API de Zernio, no del framework. Cambia "route
handler" por "endpoint de Express / FastAPI / Laravel" y todo lo demás se mantiene.

---

## Antes de empezar

Crea la cuenta en [zernio.com](https://zernio.com), saca tu API key y guarda estas
variables. Nunca en el cliente: **la API key vive solo en el servidor.**

```bash
ZERNIO_API_KEY=sk_...              # tu clave
ZERNIO_API_BASE=https://zernio.com/api/v1
ZERNIO_PROFILE_ID=                 # opcional: agrupa cuentas por cliente
ZERNIO_WEBHOOK_SECRET=             # lo generas tú, 32+ caracteres aleatorios
APP_BASE_URL=https://tu-app.com    # sin esto el webhook se registra apuntando a localhost
```

---

## Prompt 1 — El cliente HTTP

```
Construye un cliente HTTP para la API de Zernio (https://zernio.com/api/v1)
con estas reglas:

- Autenticación por header: Authorization: Bearer <ZERNIO_API_KEY>.
  La key se lee de variables de entorno y NUNCA se expone al navegador.

- El cliente NUNCA lanza excepciones. Todo vuelve como un Result discriminado:
    { success: true, data }
    { success: false, error: { status, code, message, retryAfter } }
  Motivo: este cliente se llama desde webhooks y workers donde una excepción
  no atrapada mata el proceso y pierde el mensaje.

- Timeout de 15 segundos por request (AbortSignal.timeout o equivalente).

- Reintento automático SOLO en 429, 502, 503, 504 y timeout. Nunca en un 4xx
  de validación: reintentar un 400 es quemar cuota para obtener el mismo 400.
  Backoff exponencial con jitter, y si la respuesta trae Retry-After, ese
  valor manda.

- Una opción noRetry para los llamadores con presupuesto de tiempo ajustado
  (el handler del webhook, por ejemplo).

- Soporte para headers extra, en particular Idempotency-Key: Zernio replica la
  respuesta original en vez de reenviar el mensaje si repites la request
  dentro de 24 horas. Es la diferencia entre un timeout y un cliente que
  recibe el mismo mensaje dos veces.

- Parsea el cuerpo de error buscando message y code; si no hay JSON válido,
  guarda el texto crudo. Los errores de Zernio son legibles y perderlos te
  deja depurando a ciegas.
```

---

## Prompt 2 — Conectar cuentas

```
Implementa la conexión de cuentas de Zernio. Endpoints:

  GET  /v1/accounts                        cuentas ya conectadas
  GET  /v1/profiles                        perfiles (agrupadores)
  GET  /v1/connect/{platform}              devuelve { authUrl } para el OAuth
  POST /v1/connect/whatsapp/credentials    conexión headless de una WABA propia

FLUJO OAUTH (Instagram, Messenger, WhatsApp nuevo)
El SERVIDOR pide la authUrl pasando redirect_url, y devuelve al navegador
ÚNICAMENTE esa URL, que se abre en un popup. La API key no cruza al cliente.

Dos parámetros que no son opcionales aunque la doc los presente así:

- WhatsApp, "onboarding":
    business_app -> coexistencia. El número sigue vivo en la app WhatsApp
                    Business del celular, y lo que el humano contesta desde
                    ahí también llega a tu aplicación. Es el caso normal de
                    un negocio pequeño.
    api          -> muestra el selector de WABA de Meta y saca el número del
                    teléfono. Solo sirve si el número YA está en Cloud API.

  Si eliges "api" con un número que vive en la app WhatsApp Business, Meta lo
  lista como "no cumple los requisitos". Eso NO es un problema del número: es
  el síntoma de haber elegido el modo equivocado. Expón la elección en tu
  interfaz antes de conectar, no la escondas.

- Instagram, "loginMethod":
    instagram_login -> autoriza la cuenta profesional directamente, sin
                       necesidad de una Página de Facebook. Úsalo por defecto.
    facebook_login  -> pasa por una Página con Instagram vinculado y agrega un
                       paso más de selección.

CONEXIÓN HEADLESS (BYO-WABA)
Cuando el número ya está dentro de una WABA, el Embedded Signup del navegador
no sirve: Meta no re-onboardea un número que ya pertenece a una WABA. El
camino es POST /v1/connect/whatsapp/credentials con:

  accessToken     System User token PERMANENTE de Meta, con los permisos
                  whatsapp_business_management y whatsapp_business_messaging.
                  Un token temporal de la consola funciona hoy y falla en 24h.
  wabaId
  phoneNumberId
  pin             el PIN de verificación en dos pasos del número. Si el número
                  lo tiene activado (cualquier número de negocio real lo tiene)
                  y no lo mandas, Meta responde error 133005 y el número queda
                  conectado pero sin poder enviar.

El número y la WABA siguen siendo del cliente. Zernio solo recibe credenciales
para operarla.

PERSISTENCIA
Guarda el accountId de Zernio en tu base con índice único: es la clave con la
que ruteas los mensajes entrantes hacia el cliente correcto. Ojo, Zernio
devuelve el identificador como "id" en unos endpoints y "_id" en otros;
normalízalo en una sola función.
```

---

## Prompt 3 — El webhook que recibe

Esta es la parte donde se pierden las tardes. Cuatro reglas, y las cuatro son
consecuencia de cómo entrega Zernio.

```
Crea el endpoint público que recibe los webhooks de Zernio. Cuatro reglas
obligatorias:

1. VERIFICAR LA FIRMA, SOBRE EL CUERPO CRUDO
   HMAC SHA256 del body con ZERNIO_WEBHOOK_SECRET, comparado contra el header
   X-Zernio-Signature. Viene en hex minúscula y SIN el prefijo "sha256=" que
   usa Meta.
   - Lee el cuerpo como texto ANTES de parsearlo. Si haces JSON.parse y luego
     stringify, cambian los espacios y la firma no valida nunca.
   - Compara con una función de tiempo constante (timingSafeEqual), validando
     que las longitudes coincidan antes: timingSafeEqual lanza si difieren.
   - Fail-closed: sin secreto configurado, rechaza. Un webhook público sin
     firma deja que cualquiera inyecte mensajes falsos en tu bandeja.

2. RESPONDER 2xx EN MENOS DE 5 SEGUNDOS
   Pasado ese tiempo Zernio reintenta hasta 7 veces y después manda el evento
   a una dead-letter queue. El handler debe importar lo MÍNIMO y hacer el
   trabajo pesado en segundo plano (after() en Next.js, una cola en otro
   stack), con imports dinámicos. Si tu handler arrastra el grafo entero de
   la aplicación, el cold start solo se come el presupuesto de tiempo.

3. IDEMPOTENCIA REAL, NO "creo que no se repite"
   Zernio entrega at-least-once. Tabla webhook_events con el id del evento
   como PRIMARY KEY, e insert con ON CONFLICT DO NOTHING como PRIMER paso: si
   no insertaste la fila, alguien más ya tomó el evento; devuelve 200 y corta.
   Un solo round-trip, sin condiciones de carrera.
   El id sale del header X-Zernio-Event-Id o del campo id del payload; si no
   viene ninguno, usa el SHA256 del cuerpo crudo, que sigue deduplicando entre
   reintentos del mismo evento.

4. UN SWEEPER DE RECUPERACIÓN
   Como el reintento de Zernio se auto-deduplica contra tu tabla, si el
   procesamiento en segundo plano muere el evento queda reclamado y nadie lo
   reprocesa jamás. Necesitas un endpoint que barra los eventos en estado
   'received' con más de dos minutos y los reprocese, con un tope de intentos.
   Protégelo con un secreto por header.

Además: guarda el payload completo en una columna JSON. Cuando algo salga raro
en producción, ese payload es la única prueba de qué llegó de verdad.
```

---

## Prompt 4 — Registrar el webhook por API

```
Escribe un script que dé de alta el webhook en Zernio sin pasar por el
dashboard, contra /v1/webhooks/settings (GET lista, POST crea, PUT actualiza,
DELETE borra).

  node scripts/zernio-webhook.mjs                       lista los existentes
  node scripts/zernio-webhook.mjs --url https://tu.app  crea o actualiza
  node scripts/zernio-webhook.mjs --url ... --test      dispara un webhook.test

CRÍTICO: busca primero por NOMBRE y haz PUT si ya existe. Zernio tolera hasta
50 webhooks por usuario y NO valida URLs duplicadas: sin esa búsqueda, cada
corrida del script suma una entrega más del mismo evento, y terminas
procesando todo tres veces sin entender por qué.

Suscríbete a esta lista completa. Suscribirse a menos deja huecos silenciosos:
sin message.sent no ves en tu aplicación lo que el humano contestó desde la
app de Instagram del celular.

  conversation.started
  message.received      message.sent
  message.delivered     message.read
  message.failed        message.edited      message.deleted
  account.connected     account.disconnected

Muestra también el contador de fallos de entrega en el listado: Zernio APAGA
la suscripción después de 10 fallos consecutivos. Un deploy roto que devuelva
500 un rato la deja inactiva, y no avisa nadie.

El ZERNIO_WEBHOOK_SECRET tiene que ser idéntico en tres lugares: tu entorno
local, tu hosting de producción y la suscripción de Zernio. Si no coinciden,
tu endpoint devuelve 401 y los mensajes entran a Zernio pero nunca llegan a tu
aplicación, sin ningún error visible de tu lado.
```

---

## Prompt 5 — Normalizar los eventos

```
Implementa el procesador de eventos. El envelope de todo webhook es:

  { id, event, timestamp, message?, conversation?, account? }

Los campos concretos varían por evento, así que léelos defensivamente.

SIETE COSAS QUE NO SON OBVIAS:

1. El REST y el webhook NO tienen la misma forma para la misma entidad.
     Webhook:  message.text     message.sender.id   sentAt     platformMessageId
     REST:     message.message  message.senderId    createdAt  (sin platformMessageId)
   Son dos contratos distintos. Escribe DOS adaptadores hacia tu modelo
   interno, no uno solo que intente cubrir ambos.

2. message.sent incluye lo que envió tu propia aplicación.
   Es el eco de tu propio envío volviendo por el webhook. Si no lo deduplicas,
   cada mensaje que manda tu aplicación aparece DOS VECES en la bandeja,
   aunque al cliente le llegue uno solo. La clave está en el prompt 6: guardar
   el id que devuelve el envío.

3. Los eventos llegan fuera de orden.
   message.delivered puede llegar antes de que exista el mensaje. No falles:
   marca el evento para reintento y deja que el sweeper lo tome después.

4. La dirección viene como incoming / outgoing. Normalízala a tu convención en
   un solo lugar.

5. WhatsApp: el teléfono puede no venir.
   Desde el rollout de BSUID, un usuario con username escribe sin exponer su
   número: sender.phone es nullable y el ancla estable es
   sender.businessScopedUserId. Guarda las identidades en una tabla aparte
   (una fila por identificador, con índice único), no como columna del
   contacto. Si no, esos mensajes crean un contacto nuevo cada vez.

6. La conversación no es el contacto.
   Una misma persona puede escribirte por WhatsApp y por Instagram, y esos dos
   hilos no se mezclan: son conversaciones distintas del mismo contacto.
   Modela conversations como entidad propia, con (canal, external_id).

7. El metadata trae la atribución, y casi nadie la usa.
   Los campos ctwa_* (Click To WhatsApp Ads) y meta_ad_* dicen de qué anuncio
   vino el lead: id del anuncio, titular, URL de origen. Persístelos. Es la
   diferencia entre "entraron 40 consultas" y "el anuncio B trajo 40 consultas
   y el A ninguna".

Pon el índice único de deduplicación sobre el id del mensaje en la plataforma.
Si tienes dos proveedores conviviendo durante una migración, hazlo sobre el id
SOLO, no sobre (proveedor, id): el mismo wamid puede entrar por dos webhooks
distintos y con clave compuesta se duplicaría.
```

---

## Prompt 6 — Enviar mensajes

```
Implementa el envío. Hay DOS endpoints y confundirlos es el error más común:

  POST /v1/inbox/conversations/{id}/messages   dentro de un hilo que YA existe
  POST /v1/inbox/conversations                 abrir un hilo nuevo

REGLA DE ORO: un solo camino de salida en todo tu código. Una función
enviarMensaje() que decide el endpoint, el proveedor y la persistencia. En
cuanto hay dos lugares que envían, se desincronizan, y terminas con mensajes
que salieron pero no están en tu base.

LA VENTANA DE 24 HORAS LA DECIDE TU SERVIDOR
Guarda last_inbound_at en la conversación y compáralo antes de enviar:
  - Dentro de la ventana: texto libre en los tres canales.
  - Fuera, en Instagram y Messenger: sigue siendo posible con
    messageTag: "HUMAN_AGENT" + messagingType: "MESSAGE_TAG" (vale 7 días).
  - Fuera, en WhatsApp: NO hay texto libre. Solo una plantilla aprobada.
No dejes que lo descubra el usuario con un error de la API: desactiva el campo
en la interfaz y explica por qué.

PLANTILLAS: el formato cambia según el endpoint
  - Dentro de un hilo:
      template: { elements: [ { name, language, components } ] }
    donde components es la estructura de Meta.
  - Para abrir un hilo:
      templateName, templateLanguage, templateParams
    templateParams NO son components: es un array PLANO de valores, en el orden
    en que aparecen — primero las variables del header, después las del body, y
    al final una por cada botón de URL dinámica.
  Escribe una función que aplane los components a ese array. Sin plantilla,
  abrir conversación devuelve TEMPLATE_REQUIRED: WhatsApp no permite abrir un
  hilo con texto libre.

EL ID DE RESPUESTA VIVE UN NIVEL ADENTRO
Zernio responde { success: true, data: { messageId, conversationId } }.
Si lees res.messageId obtienes undefined y guardas la fila sin id externo.
La consecuencia exacta: el webhook message.sent llega con el eco de ese mismo
mensaje, tu índice único no puede frenarlo porque la fila anterior tiene NULL,
y el mensaje aparece dos veces en la bandeja. Lee data.messageId, y como
respaldo data.messageIds[0] — Facebook e Instagram parten adjunto + texto en
dos mensajes.

Como red de seguridad adicional, al ingerir un message.sent saliente: si ya
existe una fila saliente reciente (últimos dos minutos) con el mismo texto y
sin id externo, ADÓPTALA en vez de insertar otra.

IDEMPOTENCIA AL ENVIAR: manda Idempotency-Key con un identificador estable de
ese intento de envío. Si tu request muere por timeout después de que Zernio ya
envió, el reintento no manda el mensaje dos veces.
```

---

## Prompt 7 — Importar el historial

```
Implementa la importación de conversaciones existentes:

  GET /v1/inbox/conversations                  (paginado)
  GET /v1/inbox/conversations/{id}/messages    (paginado)

- La paginación es por cursor: sigue pagination.nextCursor mientras hasMore
  sea true. Pon un TOPE DURO de páginas: si el proveedor devuelve un cursor que
  no avanza, un while sin tope es un loop infinito en producción. Corta también
  si el cursor nuevo es igual al anterior.

- Los mensajes vuelven en "messages", no en "data". La lista de conversaciones
  sí usa "data". Contempla las dos formas.

- MIRA meta.failedAccounts. Zernio no falla la request entera si una cuenta no
  responde: la degrada ahí dentro y devuelve 200 con el resto. Si no lo
  registras, una importación a medias se lee como exitosa.

- Distingue "no hay conversaciones" de "la API falló". Si el error se traga en
  silencio, una importación rota parece una cuenta vacía.

APAGA EL AGENTE ANTES DE IMPORTAR
Si tienes un agente de IA respondiendo automáticamente y corres el backfill con
él encendido, cada mensaje histórico entra como si fuera nuevo y el bot le
escribe a cientos de clientes viejos de una sola vez. Esto no se puede deshacer.
Pon un flag explícito y déjalo documentado en letras grandes.
```

---

## Prompt 8 — Verificar de punta a punta

```
Verifica la integración en este orden, y no des nada por bueno hasta el paso 6:

1. GET /v1/accounts devuelve tus cuentas conectadas.

2. El script de webhook lista tu suscripción con estado activo y 0 fallos.

3. Dispara un webhook.test y confirma que la fila aparece en tu tabla
   webhook_events. Si no aparece, el secreto no coincide entre tu hosting y
   Zernio: tu endpoint está devolviendo 401 en silencio.

4. Escribe a tu número desde otro teléfono. El mensaje debe aparecer en tu base
   en segundos, con el contacto y la conversación creados.

5. Responde desde tu aplicación. Verifica que llega al teléfono y que en tu base
   hay UNA sola fila saliente, con el id externo poblado (no NULL).

6. Responde desde la app WhatsApp Business del celular, si usas coexistencia.
   Ese mensaje también debe aparecer en tu bandeja, vía message.sent.
```

---

## Las trampas, en una tabla

Si solo te llevas una cosa de este documento, que sea esta.

| Síntoma | Causa real |
|---|---|
| El mensaje aparece dos veces en tu aplicación, pero al cliente le llega uno | Leíste `res.messageId` en vez de `res.data.messageId`; la fila quedó sin id y el eco de `message.sent` insertó otra |
| Los mensajes entran a Zernio pero nunca a tu aplicación, sin ningún error | El `ZERNIO_WEBHOOK_SECRET` no coincide entre tu hosting y la suscripción. Tu endpoint responde 401 en silencio |
| La firma nunca valida aunque el secreto sea correcto | Firmaste sobre el JSON re-serializado en vez del cuerpo crudo |
| Todo se procesa tres veces | Corriste el script de alta del webhook tres veces. Zernio no valida URLs duplicadas |
| Dejó de llegar todo, de golpe | 10 fallos de entrega consecutivos: Zernio apagó la suscripción |
| Meta dice que tu número "no cumple los requisitos" | Elegiste `onboarding=api` con un número que vive en la app WhatsApp Business. Usa `business_app` |
| El número conecta pero no puede enviar | Falta el PIN de verificación en dos pasos (error 133005 de Meta) |
| Funcionó ayer y hoy da 401 contra Meta | Usaste un token temporal de la consola. Necesitas un System User token permanente |
| Un contacto nuevo por cada mensaje del mismo cliente | WhatsApp mandó BSUID sin teléfono. Ancla la identidad en `businessScopedUserId` |
| La importación "terminó bien" pero faltan conversaciones | No miraste `meta.failedAccounts`: Zernio degradó una cuenta y devolvió 200 |
| Un evento se perdió y nunca se reprocesó | El reintento se auto-deduplicó contra tu tabla. Sin sweeper no hay recuperación |
| El bot le escribió a 300 clientes viejos | Corriste el backfill con el agente encendido |

---

## Lo que cuesta

Zernio cobra por cuenta conectada, no por mensaje. Los mensajes que **inicia el cliente**
(te escribe él) no tienen costo de Meta en WhatsApp; los que inicias tú fuera de la
ventana de 24 horas van por plantilla y sí se cobran por conversación.

Para un negocio con tres canales conectados, la mensajería queda en el orden de una
decena de dólares al mes. Si sumas un agente de IA respondiendo, ese es el que manda en
la factura, no la mensajería.

---

## Cuándo NO usar Zernio

Vale la pena ser honesto con esto antes de vender nada:

- **Necesitas la API de Grupos de WhatsApp.** No está disponible en coexistencia.
- **Tu cliente exige ser el dueño directo de la relación con Meta**, sin intermediario
  técnico. Ahí el camino es Cloud API propia y App Review.
- **Volumen muy alto con márgenes finos.** A cierta escala, ir directo a Meta sale más
  barato que cualquier capa intermedia.
- **Necesitas funciones de Meta el día que salen.** Un intermediario siempre va algunas
  semanas atrás.

Para todo lo demás —que es la mayoría de los proyectos— te ahorra semanas de
verificación y tres integraciones que mantener por separado.

---

## El orden que recomiendo

1. **Cliente HTTP** (prompt 1) — media hora
2. **Webhook con firma e idempotencia** (prompt 3) — es la pieza que sostiene todo
3. **Registro del webhook por API** (prompt 4)
4. **Conexión de una cuenta real** (prompt 2)
5. **Normalización de eventos** (prompt 5)
6. **Envío** (prompt 6)
7. **Historial** (prompt 7), solo si lo necesitas
8. **Verificación** (prompt 8)

Construir el webhook antes que el envío no es un detalle de gusto: hasta que no ves
entrar un mensaje real, todo lo demás es teoría.

---

*Documentación oficial: [docs.zernio.com](https://docs.zernio.com)*
