# =========================
# Frontend (Vite + React)
# =========================
# Étape 1: build
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copie du code (adapte si tu as d’autres dossiers: public, vite.config, etc.)
COPY . .

# Build de production (assure-toi que "build" existe dans package.json)
RUN npm run build

# Étape 2: NGINX pour servir le bundle
FROM nginx:alpine AS runner
# Copie le build Vite dans la racine web
COPY --from=builder /app/dist /usr/share/nginx/html

# Remplace la conf par défaut par la nôtre (avec proxy /api)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
