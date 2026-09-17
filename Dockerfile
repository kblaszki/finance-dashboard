# Multi-stage: Express + Prisma/SQLite + Vite static, served from one process.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && npm ci

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
RUN npx prisma generate && npm run build

WORKDIR /app/frontend
ENV VITE_API_BASE_URL=
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV STATIC_DIR=/app/public

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -r -u 1001 -U appuser

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build /app/backend/prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/frontend/dist ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /data \
  && chown -R appuser:appuser /app /data

USER appuser
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/app.js"]
