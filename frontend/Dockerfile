# Next.js (App Router) frontend image. Requires `output: "standalone"` in next.config.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder

WORKDIR /frontend

# Copy package files (including the lockfile, so `npm ci` gets exact, reproducible versions)
COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

LABEL maintainer="Racing Betting Syndicate"
LABEL description="Racing Betting Syndicate web UI"

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=builder --chown=node:node /frontend/.next/standalone ./
COPY --from=builder --chown=node:node /frontend/.next/static ./.next/static
# `public/` is optional in a Next.js app; add a COPY for it if the app has one.

USER node

# 3000 - web UI
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["node", "-e", "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
