# --- deps + build stage -----------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
# The npm bundled with node:20-alpine (10.8.x) has a known "Exit handler never
# called!" bug that can leave installs incomplete under Docker's log capture;
# upgrading npm first avoids it.
RUN npm install -g npm@11

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund --loglevel=error

COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime stage -----------------------------------------------------------
# Deliberately NOT using Next's "standalone" output: it doesn't trace the
# Prisma CLI or the seed script, which the entrypoint needs at container start
# (`prisma migrate deploy`, `tsx prisma/seed.ts`). A plain `npm ci --omit=dev`
# keeps things simple for this MVP at the cost of a somewhat larger image.
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g npm@11
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
