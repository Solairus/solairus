# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json .yarnrc.yml* yarn.lock* ./
RUN yarn install

# ── Stage 2: Compile TypeScript ───────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN yarn build

# ── Stage 3: Minimal runtime image ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
# Migrations run via: docker exec <container> node dist/scripts/migrate.js
EXPOSE 4000
CMD ["node", "dist/index.js"]
