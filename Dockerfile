# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
# The downloaded source keeps its easy local SQLite setup. Only the container
# schema uses the persistent /data directory; generate the matching client here.
RUN node --input-type=module -e 'import fs from "node:fs"; const p="prisma/schema.prisma"; const s=fs.readFileSync(p,"utf8"); if(!s.includes("file:./demo.db")) throw Error("Check Docker database configuration after changing the Prisma schema"); fs.writeFileSync(p,s.replace("file:./demo.db","file:/data/demo.db"));'
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY server ./server
RUN npx prisma generate \
    && npm test \
    && npm run build \
    && npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3001
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node --chmod=755 docker-entrypoint.sh /usr/local/bin/atelier-entrypoint
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD node -e 'fetch("http://127.0.0.1:"+(process.env.PORT||3001)+"/api/catalog",{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
ENTRYPOINT ["atelier-entrypoint"]
CMD ["node", "server/index.js"]
