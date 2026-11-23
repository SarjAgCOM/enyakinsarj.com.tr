# syntax=docker/dockerfile:1.7

# ───────────── Bağımlılıklar ─────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ───────────── Derleme ─────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts DATABASE_URL ister; generate için gerçek bağlantı gerekmez.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SITE_NAME="En Yakın Şarj"
ARG NEXT_PUBLIC_SARJAG_APP_STORE_URL
ARG NEXT_PUBLIC_SARJAG_PLAY_STORE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_SARJAG_APP_STORE_URL=$NEXT_PUBLIC_SARJAG_APP_STORE_URL \
    NEXT_PUBLIC_SARJAG_PLAY_STORE_URL=$NEXT_PUBLIC_SARJAG_PLAY_STORE_URL
RUN npx prisma generate && npm run build

# ───────────── Migration / seed (tek seferlik) ─────────────
FROM builder AS migrator
# Önce bağlantıyı doğrula (hata nedenini açıkça yazar), sonra migration ve seed.
# Hata olursa konteyner MIGRATE_HOLD_SECONDS (varsayılan 180) saniye açık kalır; böylece Coolify gibi
# platformlarda "Runtime Logs" üzerinden hata mesajı okunabilir. Ardından exit 1 ile deploy'u durdurur.
CMD ["sh", "-c", "node scripts/db-check.mjs && npx prisma migrate deploy && npx prisma db seed || { echo \"✗ migrate başarısız. Bu log okunabilsin diye konteyner ${MIGRATE_HOLD_SECONDS:-180} sn açık kalacak.\"; sleep ${MIGRATE_HOLD_SECONDS:-180}; exit 1; }"]

# ───────────── Çalışma zamanı ─────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
