# ---- backend (Express + Prisma) ----
FROM node:20-slim
WORKDIR /app

# OpenSSL pour Prisma (Debian)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Dépendances
COPY package*.json ./
RUN npm ci

# Code
COPY . .

# Génère les clients Prisma (pas besoin de DB ici)
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 4000

# Entrypoint: migrations + (seed optionnel) + serveur
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
