FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# DATABASE_PROVIDER must be known at build time for prisma generate
ARG DATABASE_PROVIDER=postgresql
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}

# Generate Prisma client for PostgreSQL
RUN npx prisma generate

# Copy the rest of the source and compile TypeScript
COPY . .
RUN npm run build

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
