import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const contacts = pgTable("contacts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  source: text("source").notNull().default("otro"),
  score: integer("score").notNull().default(0),
  notes: text("notes"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  /**
   * Campos definidos por el cliente en config/cliente.ts (`contacto.campos`):
   * { clave: valor }. Validados contra la config en src/lib/config/campos.ts.
   */
  customFields: jsonb("custom_fields").notNull().default(sql`'{}'::jsonb`),
  /** Resumen del lead escrito por el agente (tool resumen_lead), con su fecha. */
  aiSummary: text("ai_summary"),
  aiSummaryAt: timestamp("ai_summary_at", { withTimezone: true }),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  needsHuman: boolean("needs_human").notNull().default(false),
  needsHumanReason: text("needs_human_reason"),
  needsHumanAt: timestamp("needs_human_at", { withTimezone: true }),
  /**
   * Propietario: el asesor a cargo. Es la clave de visibilidad (un asesor ve solo lo
   * suyo) y lo que dispara la automatizacion `contact.assigned`. Se asigna desde la
   * ficha o por el agente (tool `asignar_asesor`); siempre via `assignContact`.
   */
  ownerId: uuid("owner_id").references(() => teamMembers.id, {
    onDelete: "set null",
  }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentJobs = pgTable("agent_jobs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").references(() => conversations.id, {
    onDelete: "cascade",
  }),
  status: text("status").notNull().default("pending"),
  processAfter: timestamp("process_after", { withTimezone: true }).notNull(),
  triggerMessageId: text("trigger_message_id"),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pipelines = pgTable("pipelines", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    /**
     * Clave estable de la etapa en config/cliente.ts (`pipeline.etapas[].clave`). La
     * usa `sincronizarPipeline` para reconocer la etapa aunque cambie el nombre, y el
     * agente para moverla por clave. NULL = etapa creada a mano desde la UI.
     */
    key: text("key"),
    name: text("name").notNull(),
    order: integer("order").notNull(),
    color: text("color").notNull().default("#64748b"),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
  },
  (t) => [unique("pipeline_stages_pipeline_key").on(t.pipelineId, t.key)]
);

export const deals = pgTable("deals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  value: integer("value").notNull().default(0),
  stageId: text("stage_id")
    .notNull()
    .references(() => pipelineStages.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  expectedClose: timestamp("expected_close", { withTimezone: true }),
  probability: integer("probability").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const activities = pgTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  description: text("description").notNull(),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  dealId: text("deal_id").references(() => deals.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const crmSettings = pgTable("crm_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Mensajes de TODOS los canales (antes `whatsapp_messages`). `external_id` es el id del
// proveedor y la clave de idempotencia del webhook via el indice unico (provider, external_id).
// `meta_message_id`, `from_phone` y `to_phone` son legacy del flujo Meta directo.
export const messages = pgTable("messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").references(() => conversations.id, {
    onDelete: "cascade",
  }),
  channel: text("channel").notNull().default("whatsapp"),
  provider: text("provider").notNull().default("meta"),
  direction: text("direction").notNull(),
  /** Salientes: agent | human | template | webhook. Entrantes: null. Lo usan los reportes. */
  origin: text("origin"),
  type: text("type").notNull().default("text"),
  body: text("body"),
  externalId: text("external_id"),
  metaMessageId: text("meta_message_id"),
  templateName: text("template_name"),
  status: text("status").notNull().default("received"),
  errorMessage: text("error_message"),
  rawPayload: jsonb("raw_payload"),
  fromPhone: text("from_phone"),
  toPhone: text("to_phone"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const whatsappTemplates = pgTable("whatsapp_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  language: text("language").notNull().default("es"),
  category: text("category").notNull(),
  components: jsonb("components").notNull(),
  status: text("status").notNull().default("PENDING"),
  metaTemplateId: text("meta_template_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Multi-tenancy (Fase 1 WhatsApp Coexistence). RLS y tenant_members -> Fase 2.
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Una fila por numero de WhatsApp conectado. `phone_number_id` es la clave de
// routing entrante; `access_token` es texto plano en Fase 1 (solo server-side).
export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  phoneNumberId: text("phone_number_id").notNull().unique(),
  wabaId: text("waba_id"),
  displayPhone: text("display_phone"),
  accessToken: text("access_token"),
  status: text("status").notNull().default("active"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// Multicanal via Zernio (Instagram DM + Facebook Messenger + WhatsApp)
// ============================================================

// Una fila por cuenta social conectada. `zernioAccountId` es la clave de routing
// entrante, el equivalente de `whatsappAccounts.phoneNumberId` en el flujo Meta directo.
export const channelAccounts = pgTable("channel_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("zernio"),
  platform: text("platform").notNull(),
  zernioAccountId: text("zernio_account_id").unique(),
  zernioProfileId: text("zernio_profile_id"),
  username: text("username"),
  displayName: text("display_name"),
  /** phone_number_id | page_id | ig_business_id, segun la plataforma. */
  externalRef: text("external_ref"),
  status: text("status").notNull().default("active"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// El hilo real. Un contacto puede tener varias: WhatsApp e Instagram no se mezclan.
export const conversations = pgTable(
  "conversations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").references(() => channelAccounts.id, {
      onDelete: "set null",
    }),
    channel: text("channel").notNull(),
    provider: text("provider").notNull().default("zernio"),
    /** conversationId de Zernio, o `legacy:<contactId>` para los hilos previos. */
    externalId: text("external_id").notNull(),
    /** Telefono E.164 | IGSID | PSID. */
    participantId: text("participant_id"),
    participantName: text("participant_name"),
    participantHandle: text("participant_handle"),
    participantPicture: text("participant_picture"),
    status: text("status").notNull().default("active"),
    unreadCount: integer("unread_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessageBody: text("last_message_body"),
    lastDirection: text("last_direction"),
    /**
     * Ventana de 24h materializada del lado del servidor. La politica de Meta no se
     * puede delegar al cliente, que es donde hoy se calcula (ChatPanel.tsx).
     */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    needsHuman: boolean("needs_human").notNull().default(false),
    needsHumanReason: text("needs_human_reason"),
    needsHumanAt: timestamp("needs_human_at", { withTimezone: true }),
    /** Campos ctwa_* y meta_ad_* de Zernio: de que anuncio vino el lead. */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("conversations_provider_external_key").on(t.provider, t.externalId),
  ]
);

// Identidad por canal. Reemplaza a `contacts.phone` como clave de deduplicacion:
// Instagram usa IGSID y Messenger PSID, no hay telefono.
export const contactIdentities = pgTable(
  "contact_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    externalId: text("external_id").notNull(),
    handle: text("handle"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("contact_identities_channel_external_key").on(
      t.channel,
      t.externalId
    ),
  ]
);

// Un agente distinto por canal. NULL = usar el fallback (crm_settings y despues el
// default hardcodeado en src/lib/agent/prompt.ts).
export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    systemPrompt: text("system_prompt"),
    enabledTools: text("enabled_tools").array(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("agent_configs_tenant_channel_key").on(t.tenantId, t.channel)]
);

/**
 * Zernio entrega at-least-once y reintenta 7 veces: el event id es la deduplicacion.
 *
 * Guarda el payload y no solo el id porque el reintento se auto-deduplica: si el
 * `after()` del handler muere despues de haber claimeado el evento, el reintento lo ve
 * como duplicado y el evento se perderia. Con el payload guardado, el sweeper reprocesa.
 */
export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  provider: text("provider").notNull().default("zernio"),
  event: text("event"),
  /** received | processed | ignored | failed */
  status: text("status").notNull().default("received"),
  attempts: integer("attempts").notNull().default(0),
  payload: jsonb("payload"),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// ============================================================
// Equipo, automatizaciones y push
// ============================================================

/**
 * Espejo de `auth.users` con lo que Supabase Auth no sabe: el rol y si sigue activo.
 * `id` ES el id del usuario de Auth. Los usuarios que existian antes de la migracion
 * quedaron como admin; los nuevos se crean desde Ajustes -> Equipo como asesor.
 */
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  /** admin | asesor */
  role: text("role").notNull().default("asesor"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Una fila por dispositivo: el mismo asesor en celular y notebook tiene dos. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [unique("push_subscriptions_member_endpoint_key").on(t.memberId, t.endpoint)]
);

/**
 * Una regla: disparador + filtros + cadena de acciones. Es DATO: se arma desde
 * /automatizaciones. El catalogo de disparadores y acciones (que existe y que hace cada
 * uno) vive en codigo, en `src/lib/automations/triggers.ts` y `actions.ts`.
 */
export const automations = pgTable("automations", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
  /** `[{ field, op, value }]` sobre el payload del disparador. Vacio = siempre. */
  filters: jsonb("filters").notNull().default(sql`'[]'::jsonb`),
  /** `[{ type, params }]` en orden de ejecucion. */
  actions: jsonb("actions").notNull().default(sql`'[]'::jsonb`),
  /** `seed` (vino en una migracion, no se borra) | `user` (creada desde la UI). */
  source: text("source").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Cola e historial en una sola tabla. Un evento genera una fila `pending` por regla
 * activa; el worker la pasa a `done`/`skipped`/`failed`. Lo que queda es el historial
 * que se ve en Ajustes -> Automatizaciones.
 */
export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  automationKey: text("automation_key")
    .notNull()
    .references(() => automations.key, { onDelete: "cascade" }),
  trigger: text("trigger").notNull(),
  contactId: text("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  /** pending | processing | done | skipped | failed */
  status: text("status").notNull().default("pending"),
  processAfter: timestamp("process_after", { withTimezone: true })
    .notNull()
    .defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  payload: jsonb("payload"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

/**
 * Notificaciones internas (la campanita). El push es best-effort; esto es el registro
 * que siempre queda: se ve en el CRM aunque el push no llegue, y se marca leida.
 */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => teamMembers.id, { onDelete: "cascade" }),
  /** automation | system */
  kind: text("kind").notNull().default("automation"),
  title: text("title").notNull(),
  body: text("body"),
  url: text("url"),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Documentos de la ficha (PDFs, cedulas, contratos). El archivo vive en un bucket
 * S3-compatible (`src/lib/storage.ts`); aca solo su ficha. `status='pending'` mientras
 * el navegador sube; 'ready' cuando el servidor confirmo que el objeto existe.
 */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
  stageId: text("stage_id").references(() => pipelineStages.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  /** pending | ready */
  status: text("status").notNull().default("pending"),
  uploadedBy: uuid("uploaded_by").references(() => teamMembers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
