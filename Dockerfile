FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

FROM dependencies AS migration
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY deployment/grant-runtime.sql ./deployment/grant-runtime.sql
USER node
CMD ["/bin/sh", "-ec", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/prisma db execute --file deployment/grant-runtime.sql"]

FROM dependencies AS build
COPY prisma.config.ts next.config.ts postcss.config.mjs tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY public ./public
RUN ./node_modules/.bin/prisma generate
# Next inspects dynamic server modules during compilation. These temporary
# values let it load them without reading host secrets or connecting to a DB.
RUN ELAT_STANDALONE=1 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    AUTH_URL=https://build.invalid \
    AUTH_SECRET=build-placeholder-never-used-at-runtime \
    AUTH_GOOGLE_ID=build-placeholder.apps.googleusercontent.com \
    AUTH_GOOGLE_SECRET=build-placeholder \
    npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
USER node
EXPOSE 3000
CMD ["/bin/sh", "-ec", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
