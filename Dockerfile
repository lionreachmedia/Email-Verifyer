# ── Stage 1: build the React app ──────────────────────────────────────
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: production server (API + worker share this image) ────────
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
RUN mkdir -p logs && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:5000/health || exit 1
CMD ["node", "src/server.js"]
