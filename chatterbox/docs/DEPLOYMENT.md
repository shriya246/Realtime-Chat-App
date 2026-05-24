<!-- Purpose: Deployment and setup guide for ChatterBox. -->

# Deployment and Setup Guide

## 1. Overview

This guide explains how ChatterBox is intended to run locally and in production-style environments. Sprint 1 provides the service layout and environment contracts. Sprint 6 will finalize production Docker images, Nginx configuration, CI, security middleware, and the final deployment checklist.

## 2. Local Development Prerequisites

- Node.js 20 or later
- npm 10 or later
- Docker Desktop with Docker Compose
- MongoDB Compass or mongosh for optional database inspection
- Redis CLI for optional cache inspection
- Azure subscription for Service Bus integration testing

## 3. Environment Setup

Create local environment files from the examples:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Replace these values before running production-like deployments:

| Variable | Required for local Docker | Required for production | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes | Yes | Use a long random secret. |
| `MONGO_URI` | Provided by compose | Yes | Use MongoDB Atlas or managed MongoDB outside local compose. |
| `REDIS_HOST` | Provided by compose | Yes | Use Redis Cloud or managed Redis outside local compose. |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | Optional | Yes | Required for real queue publishing. |
| `AZURE_SERVICE_BUS_QUEUE_NAME` | Yes | Yes | Defaults to `chatterbox-messages`. |
| `CORS_ALLOWED_ORIGINS` | Yes | Yes | Comma-separated allowed browser origins. |

## 4. Install Dependencies

Backend:

```bash
cd server
npm install
```

Frontend:

```bash
cd client
npm install
```

## 5. Local Docker Services

The Sprint 1 `docker-compose.yml` defines:

- `server`: Node.js API service
- `mongo`: MongoDB 7 with volume persistence
- `redis`: Redis 7 with append-only persistence

After Sprint 2 implements the backend entry point, run:

```bash
docker compose up --build
```

Useful local URLs after implementation:

| Service | URL |
| --- | --- |
| API health | `http://localhost:5000/api/health` |
| REST API base | `http://localhost:5000/api` |
| Socket.io | `http://localhost:5000` |
| React client | `http://localhost:3000` |

## 6. MongoDB Setup Options

### Local Docker MongoDB

Use the default `MONGO_URI`:

```text
mongodb://mongo:27017/chatterbox
```

### MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create a database user with read/write access.
3. Add the deployment IP address to the Atlas access list.
4. Copy the connection string.
5. Set `MONGO_URI` to the Atlas URI.
6. Confirm the database name is `chatterbox` or update the URI path.

## 7. Redis Setup Options

### Local Docker Redis

Use:

```text
REDIS_HOST=redis
REDIS_PORT=6379
```

### Redis Cloud

1. Create a Redis Cloud database.
2. Copy host, port, username if applicable, password, and TLS settings.
3. Set Redis variables in the server environment.
4. Enable TLS in the application config when the provider requires it.

## 8. Azure Service Bus Setup

1. Create an Azure Service Bus namespace.
2. Create a queue named `chatterbox-messages`.
3. Create a shared access policy with send/listen permissions for development.
4. Copy the connection string.
5. Set `AZURE_SERVICE_BUS_CONNECTION_STRING`.
6. Set `AZURE_SERVICE_BUS_QUEUE_NAME=chatterbox-messages`.

For local development without Azure credentials, the service layer should log a controlled warning and skip publish attempts rather than crash the chat workflow.

## 9. Health Checks

Expected final health checks:

| Target | Check |
| --- | --- |
| Server | `GET /api/health` returns process and dependency status. |
| MongoDB | Compose `mongosh` ping succeeds. |
| Redis | Compose `redis-cli ping` returns `PONG`. |
| Client | Nginx serves `index.html` and client routes fall back correctly. |

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| API cannot connect to MongoDB | Wrong host for runtime mode | Use `mongo` inside compose and `localhost` outside compose. |
| API cannot connect to Redis | Redis host or password mismatch | Verify Redis variables and provider TLS requirements. |
| Socket connects then disconnects | Missing or invalid JWT | Confirm client sends `auth.token` during Socket.io connection. |
| CORS error in browser | Client origin missing from allowlist | Add origin to `CORS_ALLOWED_ORIGINS`. |
| Queue publish fails | Missing Azure connection string or queue | Set Service Bus variables and verify queue exists. |
| Docker health check fails | Backend route not implemented yet | Health endpoint is implemented in Sprint 2. |

## 11. Production Readiness Checklist

- Use production Dockerfiles with non-root users.
- Serve the React client through Nginx.
- Use managed MongoDB and Redis with backups enabled.
- Store secrets in the deployment platform secret manager.
- Restrict CORS to real frontend domains.
- Enable Helmet security headers.
- Enable compression middleware.
- Run CI tests before deployment.
- Monitor API errors, queue failures, and dependency health.
