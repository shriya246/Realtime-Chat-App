# Purpose: Produces a minimal non-root production image for the ChatterBox API and Socket.io service.

FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S chatterbox && adduser -S chatterbox -G chatterbox

COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=chatterbox:chatterbox package*.json ./
COPY --chown=chatterbox:chatterbox src ./src

USER chatterbox
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
