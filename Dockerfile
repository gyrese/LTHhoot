# ---- BASE ----
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ---- BUILDER ----
FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/web/package.json ./packages/web/
COPY packages/socket/package.json ./packages/socket/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN cd packages/socket && npm_config_platform=linux npm_config_libc=musl npm_config_arch=x64 npm install sharp

COPY . .

RUN pnpm build

# ---- RUNNER ----
FROM alpine:3.21 AS runner

RUN apk add --no-cache nginx nodejs supervisor

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf

COPY --from=builder /app/packages/web/dist /app/web
COPY --from=builder /app/packages/socket/dist/index.cjs /app/socket/index.cjs

EXPOSE 3000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
