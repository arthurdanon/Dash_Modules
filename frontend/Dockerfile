# ---- build (CRA) ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run (Nginx) ----
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
RUN printf 'server {listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; }}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
