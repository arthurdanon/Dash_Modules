FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN printf 'server {listen 8080; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; }}' > /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

# -------- Étape run (Nginx) --------
FROM nginx:alpine
# Nginx minimal (SPA fallback)
RUN printf 'server {listen 8080; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; }}' > /etc/nginx/conf.d/default.conf

# ⚠️ IMPORTANT: CRA => "build", pas "dist"
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
