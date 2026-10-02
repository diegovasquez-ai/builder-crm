# syntax=docker/dockerfile:1
# ============================================================================
# Builder CRM - imagen de produccion (Coolify / docker compose)
# ============================================================================
# Tres etapas: deps (npm ci) -> builder (next build, standalone) -> runner (minima,
# usuario sin privilegios, migraciones al arrancar, healthcheck sobre /api/health).
#
# Las NEXT_PUBLIC_* se hornean en el bundle del navegador, por eso llegan como BUILD
# ARGS (en Coolify: marcar la variable como "Build Variable"). El resto del entorno
# (DATABASE_URL, OPENROUTER_API_KEY, ZERNIO_*, ...) es de runtime y NO va aqui.
# ============================================================================

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG SOURCE_COMMIT
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV SOURCE_COMMIT=$SOURCE_COMMIT \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S app && adduser -S app -G app

# Servidor standalone (server.js + node_modules trazados) + estaticos + publicos.
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Migraciones del nucleo y de los modulos, y el runner. `postgres` ya esta en el
# node_modules trazado porque la app lo usa.
COPY --from=builder --chown=app:app /app/supabase/migrations ./supabase/migrations
COPY --from=builder --chown=app:app /app/scripts/migrar.mjs ./scripts/migrar.mjs
COPY --from=builder --chown=app:app /app/config ./config
COPY --from=builder --chown=app:app /app/modules ./modules
COPY --chown=app:app docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
