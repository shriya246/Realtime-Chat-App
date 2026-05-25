<!-- Purpose: Portfolio-facing project overview, quickstart, and operational reference for ChatterBox. -->

# ChatterBox

**A production-oriented real-time chat application built by Shriya Patel.**

ChatterBox demonstrates a complete messaging system: authenticated REST APIs, Socket.io rooms, MongoDB persistence, Redis-backed presence and history caching, Azure Service Bus delivery events, a responsive React workspace, tested recovery behavior, and containerized deployment.

![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-010101?logo=socketdotio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

## Features

- [x] Registration, login, logout, current-user session restoration, and protected navigation
- [x] JWT authorization, bcrypt password hashing, rate limits, validation, Helmet headers, and CORS allowlists
- [x] Public/private rooms, controlled membership, room search, and cursor-paginated history
- [x] Real-time room messages, typing indicators, online presence, and optimistic client delivery state
- [x] MongoDB durable messages plus Redis cache, token blacklist, and presence TTL management
- [x] Azure Service Bus publication of accepted message delivery events
- [x] Client reconnection with bounded in-memory queued-message replay
- [x] Backend coverage enforcement and React component test suites
- [x] Multi-stage Docker images, Nginx SPA delivery, Compose health checks, and GitHub Actions CI

## Architecture

```text
Browser
  |
  v
Nginx client container (React static app)
  | REST + authenticated Socket.io
  v
Node.js server container (Express + Socket.io)
  |                 |                    |
  v                 v                    v
MongoDB          Redis             Azure Service Bus
durable data     cache/presence    delivery events
```

MongoDB is the source of truth. Redis accelerates recent room history and holds transient presence and revoked-token keys. After persistence and live emission, the server publishes a message event to Azure Service Bus for durable downstream processing. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech Stack

| Concern | Technology |
| --- | --- |
| UI | React, Vite, TailwindCSS, React Router, Axios, Lucide React |
| API and real-time | Node.js, Express, Socket.io |
| Identity and security | JWT, bcrypt, express-validator, Helmet, rate limiting |
| State services | MongoDB/Mongoose, Redis/ioredis, Azure Service Bus |
| Delivery | Docker, Docker Compose, Nginx, GitHub Actions |
| Verification | Jest, Supertest, Socket.io Client, React Testing Library |

## Quickstart With Docker

Prerequisites: Docker Desktop with Compose.

```bash
cp .env.example .env
# Set a new long JWT_SECRET value in .env before sharing or deploying.
docker compose up --build
```

Open `http://localhost:3000`, register two accounts in separate browser sessions, create or join a room, and exchange live messages. The API health route is `http://localhost:5000/api/health`.

To stop services while preserving MongoDB and Redis volumes:

```bash
docker compose down
```

## Local Development

Prerequisites: Node.js `^20.19.0` or `>=22.12.0`, npm `>=10`, MongoDB, and Redis.

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

The client runs at `http://localhost:3000` and expects the server at `http://localhost:5000`. Azure Service Bus is optional in development; saved live messages continue to work when no queue credentials are supplied.

## Testing

```bash
cd server
npm test -- --coverage --runInBand

cd ../client
npm test -- --runInBand
npm run build
```

The backend enforces at least 80% global statement and line coverage. CI repeats these checks and builds both Docker images on main-branch changes and pull requests.

## REST API

All protected routes require `Authorization: Bearer <jwt>`.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Dependency-aware service status |
| `POST` | `/api/auth/register` | No | Create account and return JWT |
| `POST` | `/api/auth/login` | No | Authenticate and return JWT |
| `POST` | `/api/auth/logout` | Yes | Blacklist active token |
| `GET` | `/api/auth/me` | Yes | Get signed-in user |
| `GET` | `/api/users?search=` | Yes | Search user profiles |
| `GET` | `/api/users/:id` | Yes | Get public profile |
| `POST` | `/api/rooms` | Yes | Create room |
| `GET` | `/api/rooms` | Yes | List accessible rooms |
| `GET` | `/api/rooms/:id` | Yes | Get accessible room |
| `POST` | `/api/rooms/:id/members` | Yes | Add private-room member |
| `DELETE` | `/api/rooms/:id/members/me` | Yes | Leave room |
| `GET` | `/api/rooms/:id/messages` | Yes | Cursor-paginated history |

## Socket.io Events

The socket handshake supplies `auth: { token: "<jwt>" }`.

| Direction | Event | Purpose |
| --- | --- | --- |
| Client -> Server | `join_room` | Enter an accessible room and request cached history |
| Client -> Server | `leave_room` | Leave an active room |
| Client -> Server | `send_message` | Persist and broadcast a message |
| Client -> Server | `user_typing` | Report composer activity |
| Server -> Client | `message_history` | Deliver latest room messages |
| Server -> Client | `receive_message` | Deliver a live message |
| Server -> Client | `typing_indicator` | Show or clear typing state |
| Server -> Client | `online_users` | Initialize presence list |
| Server -> Client | `user_online` / `user_offline` | Update presence |
| Server -> Client | `socket_error` | Report event authorization or validation failure |

Full payloads are documented in [docs/API_SPEC.md](docs/API_SPEC.md).

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode: `development`, `test`, or `production` |
| `CLIENT_PORT`, `SERVER_PORT` | Host ports exposed by Docker Compose |
| `CLIENT_URL`, `CORS_ALLOWED_ORIGINS` | Browser URL and accepted comma-separated origins |
| `VITE_API_BASE_URL`, `VITE_SOCKET_URL` | REST and socket URLs compiled into the client build |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT signing secret and token lifetime |
| `BCRYPT_SALT_ROUNDS` | Password hash work factor |
| `MONGO_URI`, `MONGO_TEST_URI` | Runtime and automated-test MongoDB endpoints |
| `MONGO_INITDB_DATABASE`, `MONGO_MAX_POOL_SIZE`, `MONGO_PORT` | Local Mongo setup, server pool limit, and published port |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PUBLIC_PORT` | Redis runtime and host exposure endpoints |
| `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS` | Redis authentication/database/TLS settings |
| `REDIS_CLUSTER_NODES` | Optional comma-separated managed cluster startup nodes |
| `AZURE_SERVICE_BUS_CONNECTION_STRING`, `AZURE_SERVICE_BUS_QUEUE_NAME` | Delivery-event queue credentials and queue name |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | Authentication brute-force protections |
| `MESSAGE_HISTORY_LIMIT`, `MESSAGE_CACHE_TTL_SECONDS` | Recent-message cache size and expiry |
| `ONLINE_USER_TTL_SECONDS` | Online-presence key expiry |
| `JSON_BODY_LIMIT`, `COMPRESSION_THRESHOLD_BYTES` | HTTP body and compression controls |
| `TRUST_PROXY`, `SHUTDOWN_TIMEOUT_MS` | Reverse-proxy handling and graceful shutdown timeout |

Production startup validates `JWT_SECRET`, `MONGO_URI`, `CORS_ALLOWED_ORIGINS`, and `AZURE_SERVICE_BUS_CONNECTION_STRING`.

## Project Structure

```text
chatterbox/
|-- .github/workflows/ci.yml
|-- client/
|   |-- src/
|   |-- Dockerfile
|   `-- nginx.conf
|-- docs/
|   |-- API_SPEC.md
|   |-- ARCHITECTURE.md
|   |-- DB_SCHEMA.md
|   |-- DEPLOYMENT.md
|   |-- SPRINT_LOG.md
|   |-- SRS.md
|   `-- TEST_PLAN.md
|-- server/
|   |-- src/
|   |-- tests/
|   `-- Dockerfile
|-- .env.example
|-- docker-compose.yml
`-- docker-compose.prod.yml
```

## Known Limitations

- The delivered topology uses one Node.js server instance; multi-instance Socket.io fan-out requires the Redis adapter.
- Queued outgoing messages survive short socket drops in an active tab, not browser restarts.
- Azure Service Bus publishes delivery events; a dedicated notification/replay consumer is outside this release.
- Read receipts beyond delivered message state are not included.

## Future Improvements

- Add Redis Socket.io adapter and load-balanced API replicas.
- Add delivery-event workers, dead-letter monitoring, and push notifications.
- Add file attachments, moderation tools, per-room roles, and read receipts.
- Add end-to-end browser tests and observability dashboards.

## Documentation

[SRS](docs/SRS.md) | [Architecture](docs/ARCHITECTURE.md) | [API](docs/API_SPEC.md) | [Schema](docs/DB_SCHEMA.md) | [Test Plan](docs/TEST_PLAN.md) | [Deployment](docs/DEPLOYMENT.md) | [Sprint Log](docs/SPRINT_LOG.md)

## License

MIT License. Built by Shriya Patel as a portfolio demonstration of full-stack and distributed-system engineering.
