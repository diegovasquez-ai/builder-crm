-- Modulo propiedades. Idempotente. Requiere pgvector (Supabase lo trae).

create extension if not exists vector;

create table if not exists propiedades (
  id               text primary key,
  external_id      text not null unique,
  reference_code   text,
  title            text,
  property_type    text,
  operation        text,
  price            numeric,
  currency         text,
  rooms            integer,
  bedrooms         integer,
  bathrooms        integer,
  surface_total    numeric,
  surface_covered  numeric,
  neighborhood     text,
  full_location    text,
  address          text,
  geo_lat          numeric,
  geo_lng          numeric,
  credit_eligible  boolean,
  expenses         numeric,
  amenities        text[] not null default '{}'::text[],
  cover_photo      text,
  photos           jsonb not null default '[]'::jsonb,
  public_url       text,
  status           integer,
  description      text,
  embedding_text   text,
  embedding        vector(1536),
  raw              jsonb,
  synced_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists propiedades_operation_idx     on propiedades (operation);
create index if not exists propiedades_property_type_idx on propiedades (property_type);
create index if not exists propiedades_price_idx         on propiedades (price);
create index if not exists propiedades_embedding_idx     on propiedades using hnsw (embedding vector_cosine_ops);

-- Busqueda hibrida: filtros duros (SQL) + ranking semantico (coseno). Cualquier
-- filtro en null se ignora. similarity = 1 es identico.
create or replace function propiedades_buscar(
  query_embedding        vector(1536),
  match_count            int     default 5,
  filter_operation       text    default null,
  filter_property_type   text    default null,
  min_price              numeric default null,
  max_price              numeric default null,
  filter_currency        text    default null,
  min_rooms              int     default null,
  filter_neighborhood    text    default null,
  filter_credit_eligible boolean default null
) returns table (
  id text, external_id text, title text, property_type text, operation text, price numeric,
  currency text, rooms integer, bedrooms integer, bathrooms integer, surface_total numeric,
  neighborhood text, full_location text, address text, amenities text[], expenses numeric,
  credit_eligible boolean, cover_photo text, public_url text, description text, similarity float
) language sql stable as $$
  select
    p.id, p.external_id, p.title, p.property_type, p.operation, p.price, p.currency,
    p.rooms, p.bedrooms, p.bathrooms, p.surface_total, p.neighborhood, p.full_location,
    p.address, p.amenities, p.expenses, p.credit_eligible, p.cover_photo, p.public_url,
    p.description,
    1 - (p.embedding <=> query_embedding) as similarity
  from propiedades p
  where p.embedding is not null
    and (filter_operation is null or p.operation ilike filter_operation)
    and (filter_property_type is null or p.property_type ilike '%' || filter_property_type || '%')
    and (min_price is null or p.price >= min_price)
    and (max_price is null or p.price <= max_price)
    and (filter_currency is null or p.currency = filter_currency)
    and (min_rooms is null or p.rooms >= min_rooms)
    and (filter_neighborhood is null
         or p.neighborhood ilike '%' || filter_neighborhood || '%'
         or p.full_location ilike '%' || filter_neighborhood || '%')
    and (filter_credit_eligible is null or p.credit_eligible = filter_credit_eligible)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS: todo miembro puede leer el catalogo por la API publica.
alter table propiedades enable row level security;
drop policy if exists propiedades_select on propiedades;
create policy propiedades_select on propiedades for select to authenticated
  using (public.es_miembro());
