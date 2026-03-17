# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install prisma --save
COPY prisma ./prisma/
RUN npx prisma generate
COPY --from=builder /app/dist ./dist/
# Do not override PORT here. Railway may inject it at runtime via env vars.
# Keep EXPOSE so Railway/routers can infer the container port if needed.
EXPOSE 4000
# Start server immediately so healthchecks can pass, then run migrations in parallel.
# If the DB is temporarily unreachable, migrations will fail but the server stays up (check logs).
CMD ["sh", "-c", "node dist/index.js & (npx prisma migrate deploy || true); wait"]
