# Website image.  Coolify: Base Directory = /client, Dockerfile = /Dockerfile, Port = 80
# Set VITE_API_URL as a *build* variable, e.g. https://api.yourdomain.com/api

# ── Build the React app ──
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN echo "Building with VITE_API_URL=${VITE_API_URL}" && npm run build

# ── Serve it with Nginx ──
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
