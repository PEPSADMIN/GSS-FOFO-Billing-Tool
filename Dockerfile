FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

# Copy workspace root manifests
COPY package.json package-lock.json ./

# Copy shared package (backend imports @gss/shared from workspace)
COPY shared/package.json ./shared/
COPY shared/src ./shared/src/
COPY shared/tsconfig.json ./shared/

# Copy backend manifests and prisma schema
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma/
COPY backend/tsconfig.json ./backend/

# Install all workspace dependencies from repo root
RUN npm install

# Patch schema provider from sqlite (local dev default) to postgresql for production
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' /repo/backend/prisma/schema.prisma

# Copy backend source
COPY backend/src ./backend/src/

WORKDIR /repo/backend

RUN npx prisma generate
RUN npm run build

EXPOSE 4000

CMD ["node", "dist/server.js"]
