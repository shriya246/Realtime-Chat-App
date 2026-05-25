<!-- Purpose: Complete deployment, environment, health-check, and troubleshooting guide for ChatterBox. -->

# Deployment and Setup Guide

## 1. Deployment Model

ChatterBox ships with a production-shaped local topology:

```text
Browser -> Nginx/React client -> Express + Socket.io server
                                      |       |       |
                                   MongoDB  Redis  Azure Service Bus
```

The base Compose file starts the client, server, MongoDB, and Redis. Azure Service Bus is a managed external service: it is optional for local development and required when `NODE_ENV=production`.

## 2. Prerequisites

| Workflow | Requirements |
| --- | --- |
| Docker quickstart | Docker Desktop and Docker Compose |
| Native development | Node.js `^20.19.0` or `>=22.12.0`, npm `>=10`, MongoDB, Redis |
| Production deployment | Secure secret storage, accessible MongoDB and Redis, Azure Service Bus queue, TLS/reverse proxy |

## 3. Local Docker Quickstart

From the project root:

```bash
cp .env.example .env
# Replace JWT_SECRET in .env with a long random local secret.
docker compose up --build
```

| Service | Local address |
| --- | --- |
| React application | `http://localhost:3000` |
| REST API | `http://localhost:5000/api` |
| Socket.io server | `http://localhost:5000` |
| Health endpoint | `http://localhost:5000/api/health` |
| MongoDB published port | `localhost:27017` |
| Redis published port | `localhost:6379` |

Persistent volumes keep MongoDB and Redis state after `docker compose down`. Use `docker compose down --volumes` only when local stored messages and accounts may be discarded.

## 4. Native Development Setup

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env

cd server
npm install
npm run dev

cd ../client
npm install
npm run dev
```

For native development, update `server/.env` from Docker hostnames to local dependencies:

```dotenv
MONGO_URI=mongodb://localhost:27017/chatterbox
REDIS_HOST=localhost
```

## 5. Runtime Environment Reference

### HTTP, Browser, and Security

| Variable | Local value | Production guidance |
| --- | --- | --- |
| `NODE_ENV` | `development` | Set `production`; enables required-variable validation. |
| `SERVER_PORT` / `PORT` | `5000` | Internal API listener or platform-injected port. |
| `CLIENT_PORT` | `3000` | Public Nginx port mapping when using Compose. |
| `CLIENT_URL` | `http://localhost:3000` | Public HTTPS frontend origin. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Required allowlist of HTTPS UI origins. |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Public HTTPS API URL at client image build time. |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Public HTTPS Socket.io URL at client image build time. |
| `JWT_SECRET` | Replace template value | Required; store as a long random secret. |
| `JWT_EXPIRES_IN` | `1h` | Short-lived access-token duration. |
| `BCRYPT_SALT_ROUNDS` | `12` | Increase only after latency assessment. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Authentication attempt window. |
| `AUTH_RATE_LIMIT_MAX` | `20` | Attempts accepted within the window. |
| `JSON_BODY_LIMIT` | `1mb` | Maximum parsed request payload. |
| `COMPRESSION_THRESHOLD_BYTES` | `1024` | Minimum response size for gzip compression. |
| `TRUST_PROXY` | `false` | Set `true` behind a controlled reverse proxy. |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful resource shutdown deadline. |

### Data and Integration Services

| Variable | Local value | Production guidance |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://mongo:27017/chatterbox` | Required Atlas or managed MongoDB URI. |
| `MONGO_TEST_URI` | Local test URI | Only used by tests. |
| `MONGO_INITDB_DATABASE` | `chatterbox` | Local Mongo container initialization. |
| `MONGO_MAX_POOL_SIZE` | `10` | Tune per API replica and provider limit. |
| `MONGO_PORT` | `27017` | Local published port only. |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` | Managed Redis endpoint. |
| `REDIS_PUBLIC_PORT` | `6379` | Local published port only. |
| `REDIS_PASSWORD` | Empty | Supply through secret storage when required. |
| `REDIS_DB` / `REDIS_TLS` | `0` / `false` | Enable TLS for managed providers. |
| `REDIS_CLUSTER_NODES` | Empty | Optional `host-a:6379,host-b:6379` for cluster mode. |
| `MESSAGE_HISTORY_LIMIT` | `50` | Cached/join-history message count. |
| `MESSAGE_CACHE_TTL_SECONDS` | `86400` | Recent-history cache duration. |
| `ONLINE_USER_TTL_SECONDS` | `3600` | Presence expiry guard. |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | Empty | Required in production; use secret storage. |
| `AZURE_SERVICE_BUS_QUEUE_NAME` | `chatterbox-messages` | Queue receiving delivery events. |

## 6. Production Compose Deployment

The production override sets `NODE_ENV=production`, trusts the deployment proxy, requires external service credentials, and applies resource limits.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Before launching, provide at minimum:

```dotenv
CLIENT_URL=https://chat.example.com
CORS_ALLOWED_ORIGINS=https://chat.example.com
VITE_API_BASE_URL=https://api.example.com/api
VITE_SOCKET_URL=https://api.example.com
JWT_SECRET=<secret-manager-value>
MONGO_URI=<managed-mongodb-uri>
AZURE_SERVICE_BUS_CONNECTION_STRING=<secret-manager-value>
```

For an external Redis service also replace `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and `REDIS_TLS`; clustered providers may use `REDIS_CLUSTER_NODES`. In a hosted platform, deploy only the `client` and `server` images and bind managed data services rather than running the Compose MongoDB/Redis containers.

## 7. Azure Service Bus Setup

1. In Azure, create a Service Bus namespace using Standard or Premium tier.
2. Create a queue named `chatterbox-messages`, or choose a name and set `AZURE_SERVICE_BUS_QUEUE_NAME`.
3. Create a shared access policy scoped to the queue with `Send` and `Listen` rights for the application workload.
4. Store the policy connection string in the deployment secret manager as `AZURE_SERVICE_BUS_CONNECTION_STRING`.
5. Launch the server and send a message in a room.
6. Verify an event appears in the queue metrics or with a controlled receiver process.

The live chat message is persisted before publication. A transient queue publish failure is logged without deleting or hiding an already delivered message.

## 8. MongoDB Atlas Option

1. Create an Atlas project and cluster.
2. Create a least-privilege database user with application database read/write rights.
3. Restrict network access to deployment egress addresses.
4. Copy an SRV connection string with the `chatterbox` database path.
5. Set `MONGO_URI` and tune `MONGO_MAX_POOL_SIZE` against the provider connection limit.
6. Configure backup and alerting policies.

## 9. Redis Cloud Option

1. Create a Redis Cloud database in the deployment region.
2. Copy endpoint, port, credentials, and TLS requirement.
3. Configure `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and `REDIS_TLS=true` where applicable.
4. For clustered plans, specify startup endpoints in `REDIS_CLUSTER_NODES`.
5. Verify the API health route reports Redis as `ready`.

## 10. Health and Operational Checks

| Component | Check | Healthy result |
| --- | --- | --- |
| Server | `GET /api/health` | HTTP `200`, `status: "ok"`, MongoDB and Redis `ready` |
| Client | `GET /health` inside/client container | HTTP `200` from Nginx |
| MongoDB | Compose `mongosh` health check | Ping succeeds |
| Redis | Compose `redis-cli ping` health check | `PONG` |
| Service Bus | Send a chat message with credentials configured | Queue delivery event accepted |

The server returns HTTP `503` with `status: "degraded"` when required local MongoDB or Redis readiness is unavailable.

## 11. CI Pipeline

`.github/workflows/ci.yml` runs on changes targeting `main`. It installs from lockfiles, runs backend coverage enforcement, runs frontend tests, produces the Vite bundle, and builds both production Docker images.

## 12. Troubleshooting

| Symptom | Cause to check | Resolution |
| --- | --- | --- |
| Server exits at startup in production | Required variables are missing | Supply JWT, MongoDB, CORS, and Azure Service Bus values. |
| Health endpoint returns `503` | MongoDB or Redis unavailable | Inspect connection URI/host, TLS, credentials, and container health. |
| Browser reports CORS failure | Origin not in allowlist | Add the exact UI origin to `CORS_ALLOWED_ORIGINS` and restart. |
| Socket authentication fails | Missing, expired, or revoked JWT | Sign in again and inspect handshake `auth.token`. |
| History is absent on join | No stored messages or dependency issue | Check MongoDB persistence and Redis readiness. |
| Service Bus publish logs failure | Queue policy/name/network mismatch | Confirm queue, access rights, and secret value. |
| Client calls old API domain | Vite values changed after build | Rebuild the client image with updated `VITE_*` values. |

## 13. Release Checklist

- Rotate all template secrets and use secret-manager injection.
- Set HTTPS browser origins and public API/socket build URLs.
- Confirm managed MongoDB backups and Redis TLS/access controls.
- Confirm Azure Service Bus queue permissions and monitoring.
- Run server coverage, client tests, and the client production build.
- Build images and validate health probes in the target environment.
- Monitor application errors, dependency readiness, and queue failures after release.
