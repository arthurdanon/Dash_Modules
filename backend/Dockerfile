# =========================
# Backend (Express + Prisma)
# =========================
# Étape 1: deps + prisma generate (avec devDeps)
FROM node:20-slim AS builder
WORKDIR /app

# Install deps (y compris dev) pour pouvoir exécuter `prisma generate`
COPY package*.json ./
RUN npm ci

# Prisma schema pour générer le client
COPY prisma ./prisma
RUN npx prisma generate

# Code de l’app
COPY src ./src

# Étape 2: image finale prod, légère (deps prod uniquement)
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Installer uniquement les deps prod
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le client Prisma généré depuis l’étape builder
# (les moteurs Prisma et @prisma/client)
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma

# Copier le code et le schema (utile si tu fais des migrations au runtime)
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

# (optionnel) healthcheck basique
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT||4000) + '/healthz', r=>{if(r.statusCode!==200)process.exit(1)}).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
