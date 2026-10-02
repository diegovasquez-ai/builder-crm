-- ============================================================================
-- Builder CRM - migracion base (schema completo del nucleo)
-- ============================================================================
-- Generada desde src/db/schema.ts con drizzle-kit y completada a mano con lo que
-- Drizzle no describe: extensiones, indices, funciones SQL y filas semilla.
--
-- Idempotente: se puede correr sobre una base vacia o sobre una que ya la tenga.
-- Hasta la version 1.0.0 este archivo se REGENERA cuando cambia el schema; desde
-- 1.0.0 solo se agregan migraciones nuevas (ver specs/nucleo/06-base-desplegable.md).
--
-- Requiere Supabase (o Postgres con el schema `auth` y la funcion auth.uid()): la
-- migracion de RLS que sigue a esta depende de eso.
-- ============================================================================

-- Extensiones -----------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- Tablas ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"contact_id" text NOT NULL,
	"deal_id" text,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"system_prompt" text,
	"enabled_tools" text[],
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_configs_tenant_channel_key" UNIQUE("tenant_id","channel")
);
CREATE TABLE IF NOT EXISTS "agent_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"conversation_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"process_after" timestamp with time zone NOT NULL,
	"trigger_message_id" text,
	"tenant_id" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_key" text NOT NULL,
	"trigger" text NOT NULL,
	"contact_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"process_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "automations" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "channel_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text DEFAULT 'zernio' NOT NULL,
	"platform" text NOT NULL,
	"zernio_account_id" text,
	"zernio_profile_id" text,
	"username" text,
	"display_name" text,
	"external_ref" text,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_accounts_zernio_account_id_unique" UNIQUE("zernio_account_id")
);
CREATE TABLE IF NOT EXISTS "contact_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" text NOT NULL,
	"channel" text NOT NULL,
	"external_id" text NOT NULL,
	"handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_identities_channel_external_key" UNIQUE("channel","external_id")
);
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"source" text DEFAULT 'otro' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_summary" text,
	"ai_summary_at" timestamp with time zone,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"needs_human" boolean DEFAULT false NOT NULL,
	"needs_human_reason" text,
	"needs_human_at" timestamp with time zone,
	"owner_id" uuid,
	"assigned_at" timestamp with time zone,
	"tenant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"contact_id" text,
	"account_id" uuid,
	"channel" text NOT NULL,
	"provider" text DEFAULT 'zernio' NOT NULL,
	"external_id" text NOT NULL,
	"participant_id" text,
	"participant_name" text,
	"participant_handle" text,
	"participant_picture" text,
	"status" text DEFAULT 'active' NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_body" text,
	"last_direction" text,
	"last_inbound_at" timestamp with time zone,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"needs_human" boolean DEFAULT false NOT NULL,
	"needs_human_reason" text,
	"needs_human_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_provider_external_key" UNIQUE("provider","external_id")
);
CREATE TABLE IF NOT EXISTS "crm_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
CREATE TABLE IF NOT EXISTS "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"stage_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"expected_close" timestamp with time zone,
	"probability" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" text NOT NULL,
	"deal_id" text,
	"stage_id" text,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
CREATE TABLE IF NOT EXISTS "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"conversation_id" text,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"provider" text DEFAULT 'meta' NOT NULL,
	"direction" text NOT NULL,
	"origin" text,
	"type" text DEFAULT 'text' NOT NULL,
	"body" text,
	"external_id" text,
	"meta_message_id" text,
	"template_name" text,
	"status" text DEFAULT 'received' NOT NULL,
	"error_message" text,
	"raw_payload" jsonb,
	"from_phone" text,
	"to_phone" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"tenant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text DEFAULT 'automation' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"url" text,
	"contact_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "pipeline_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pipeline_stages_pipeline_key" UNIQUE("pipeline_id","key")
);
CREATE TABLE IF NOT EXISTS "pipelines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_member_endpoint_key" UNIQUE("member_id","endpoint")
);
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'asesor' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_email_unique" UNIQUE("email")
);
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'zernio' NOT NULL,
	"event" text,
	"status" text DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone_number_id" text NOT NULL,
	"waba_id" text,
	"display_phone" text,
	"access_token" text,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_accounts_phone_number_id_unique" UNIQUE("phone_number_id")
);
CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"category" text NOT NULL,
	"components" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"meta_template_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Claves foraneas ---------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_contact_id_contacts_id_fk') THEN
    ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_deal_id_deals_id_fk') THEN
    ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_configs_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_jobs_contact_id_contacts_id_fk') THEN
    ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_jobs_conversation_id_conversations_id_fk') THEN
    ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_jobs_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_runs_automation_key_automations_key_fk') THEN
    ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_key_automations_key_fk" FOREIGN KEY ("automation_key") REFERENCES "public"."automations"("key") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_runs_contact_id_contacts_id_fk') THEN
    ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channel_accounts_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "channel_accounts" ADD CONSTRAINT "channel_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_identities_contact_id_contacts_id_fk') THEN
    ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_owner_id_team_members_id_fk') THEN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_team_members_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_contact_id_contacts_id_fk') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_account_id_channel_accounts_id_fk') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_account_id_channel_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."channel_accounts"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_stage_id_pipeline_stages_id_fk') THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_contact_id_contacts_id_fk') THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_contact_id_contacts_id_fk') THEN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_deal_id_deals_id_fk') THEN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_stage_id_pipeline_stages_id_fk') THEN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_uploaded_by_team_members_id_fk') THEN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_team_members_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_contact_id_contacts_id_fk') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_conversations_id_fk') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_member_id_team_members_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_contact_id_contacts_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_pipeline_id_pipelines_id_fk') THEN
    ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_member_id_team_members_id_fk') THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_accounts_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

-- Indices -----------------------------------------------------------------------
create index if not exists contacts_owner_id_idx       on contacts (owner_id);
create index if not exists contacts_tenant_idx         on contacts (tenant_id);
create index if not exists contacts_needs_human_idx    on contacts (needs_human) where needs_human = true;

create index if not exists agent_jobs_contact_status_idx on agent_jobs (contact_id, status);
create index if not exists agent_jobs_process_after_idx  on agent_jobs (process_after) where status = 'pending';
create index if not exists agent_jobs_conversation_idx   on agent_jobs (conversation_id);
create index if not exists agent_jobs_tenant_idx         on agent_jobs (tenant_id);

create index if not exists conversations_contact_idx   on conversations (contact_id);
create index if not exists conversations_tenant_idx    on conversations (tenant_id);
create index if not exists conversations_channel_idx   on conversations (channel);
create index if not exists conversations_last_msg_idx  on conversations (last_message_at desc nulls last);

-- OJO: unicidad sobre external_id SOLO, a proposito y no sobre (provider, external_id):
-- en el dual-run del cutover de WhatsApp el mismo wamid.* puede entrar por el webhook de
-- Meta y por el de Zernio; con clave compuesta se duplicaria. ingest.ts hace ON CONFLICT
-- sobre este indice.
create unique index if not exists messages_external_id_key on messages (external_id) where external_id is not null;
create index if not exists messages_conversation_idx  on messages (conversation_id, created_at);
create index if not exists messages_contact_idx       on messages (contact_id);
create index if not exists messages_tenant_idx        on messages (tenant_id);

create index if not exists contact_identities_contact_idx on contact_identities (contact_id);
create index if not exists channel_accounts_tenant_idx    on channel_accounts (tenant_id);
create index if not exists channel_accounts_platform_idx  on channel_accounts (platform);
create index if not exists whatsapp_accounts_tenant_idx   on whatsapp_accounts (tenant_id);
create index if not exists webhook_events_status_idx      on webhook_events (status, received_at);

create index if not exists automation_runs_pending_idx on automation_runs (status, process_after);
create index if not exists automation_runs_created_idx on automation_runs (created_at desc);

create index if not exists notifications_member_unread_idx  on notifications (member_id, created_at desc) where read_at is null;
create index if not exists notifications_member_created_idx on notifications (member_id, created_at desc);

create index if not exists documents_contact_ready_idx on documents (contact_id, created_at desc) where status = 'ready';

-- Semillas (idempotentes) -------------------------------------------------------
-- Una instancia = un negocio. `tenants` queda por compatibilidad con el routing de
-- cuentas; siempre hay exactamente una fila, la `default`.
insert into tenants (name, slug) values ('Default', 'default')
on conflict (slug) do nothing;

-- Un agente por canal. WhatsApp arranca encendido; Instagram y Messenger apagados:
-- hasta que no tengan prompt propio contestarian con el de WhatsApp.
insert into agent_configs (tenant_id, channel, enabled)
select t.id, ch.channel, ch.enabled
from tenants t
cross join (values ('whatsapp', true), ('instagram', false), ('facebook', false)) as ch(channel, enabled)
where t.slug = 'default'
on conflict (tenant_id, channel) do nothing;

-- Automatizacion de ejemplo (source = seed: se puede apagar, no borrar).
insert into automations (key, name, description, trigger, enabled, filters, actions, source)
values (
  'contact_assigned_push',
  'Avisar al asesor cuando se le asigna un contacto',
  'Envia una notificacion push al asesor al que se le asigna el contacto, ya sea desde la ficha o por el agente de IA.',
  'contact.assigned',
  true,
  '[]'::jsonb,
  '[{"type":"push","params":{"to":"owner","title":"Nuevo contacto asignado","body":"{{contacto}} - te lo asigno {{quien}}"}}]'::jsonb,
  'seed'
)
on conflict (key) do nothing;
