# Next.js (App Router) frontend image, built from the Devias Kit Free baseline (see SOURCE.md).
# The kit ships a pnpm lockfile and no `output: "standalone"`, so the image installs with pnpm
# and serves with `next start`.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder

WORKDIR /frontend

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Install from the lockfile first so the dependency layer is cached
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . ./
RUN pnpm run build && pnpm prune --prod

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

LABEL maintainer="Racing Betting Syndicate"
LABEL description="Racing Betting Syndicate web UI"

ENV NODE_ENV=production \
    PORT=3420 \
    HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=builder --chown=node:node /frontend/package.json ./
COPY --from=builder --chown=node:node /frontend/next.config.mjs ./
COPY --from=builder --chown=node:node /frontend/public ./public
COPY --from=builder --chown=node:node /frontend/.next ./.next
COPY --from=builder --chown=node:node /frontend/node_modules ./node_modules

USER 1000

# 3420 - web UI
EXPOSE 3420

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["node", "-e", "fetch('http://localhost:3420/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node_modules/.bin/next", "start"]
