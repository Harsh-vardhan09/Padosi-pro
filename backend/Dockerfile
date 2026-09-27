FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json prisma.config.ts ./
# Needed before npm ci: the postinstall hook runs `prisma generate` against this schema.
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 4000
# Migrations are applied at container start, so `docker compose up` stays a single command.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/db/seed.js && node dist/index.js"]
