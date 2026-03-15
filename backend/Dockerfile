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
ENV PORT=4000
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install prisma --save
COPY prisma ./prisma/
RUN npx prisma generate
COPY --from=builder /app/dist ./dist/
EXPOSE 4000
# Run migrations; if DB unreachable, still start server so health check can pass (check logs for migrate errors)
CMD ["sh", "-c", "npx prisma migrate deploy || true && node dist/index.js"]
