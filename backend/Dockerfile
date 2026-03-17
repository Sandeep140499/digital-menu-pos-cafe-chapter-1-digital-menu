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
# Debug-friendly startup for Railway: print dist contents and PORT, then run server.
# (Once stable, we can re-add `prisma migrate deploy` without blocking healthchecks.)
CMD ["sh", "-c", "echo \"[startup] PORT=${PORT}\" && echo \"[startup] dist contents:\" && ls -la dist && node dist/index.js"]
