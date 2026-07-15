FROM node:20-alpine

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
# (npm workspaces creates symlink: node_modules/@gss/shared -> ../shared)
RUN npm install

# Copy backend source
COPY backend/src ./backend/src/

# Set provider for prisma generate (postgresql = production default)
ARG DATABASE_PROVIDER=postgresql
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}

WORKDIR /repo/backend

RUN npx prisma generate
RUN npm run build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
