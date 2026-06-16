# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json .yarnrc.yml* yarn.lock* ./
RUN yarn install

# ── Stage 2: Build Vite app ───────────────────────────────────────────────────
FROM deps AS builder
# VITE_API_BASE_URL is baked into the bundle at build time.
# Set this to the full URL of the backend service on Railway:
# e.g. https://solairus-api.up.railway.app/api
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY . .
RUN yarn build

# ── Stage 3: Serve with Caddy ─────────────────────────────────────────────────
# Caddy binds Railway's injected $PORT (Caddyfile: :{$PORT:80}), avoiding the
# fixed-port mismatch that 502s nginx on Railway.
FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
