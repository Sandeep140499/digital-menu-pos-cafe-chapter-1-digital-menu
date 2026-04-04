# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist/
# Do not override PORT here. Railway may inject it at runtime via env vars.
# Keep EXPOSE so Railway/routers can infer the container port if needed.
EXPOSE 4000
# Apply pending migrations before serving (required for prod menu/data SQL migrations).
# Fails fast if DATABASE_URL is wrong or migrate errors — check deploy logs.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
