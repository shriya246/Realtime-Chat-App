<!-- Purpose: Portfolio-facing project overview and setup guide for ChatterBox. -->

# ChatterBox

ChatterBox is a production-oriented real-time chat application built for Shriya Patel's software engineering portfolio. The project demonstrates secure authentication, persistent messaging, room-based real-time communication, Redis-backed presence and caching, and an Azure Service Bus delivery pipeline for reliable asynchronous processing.

## Current Sprint Status

Sprint 1 establishes the project foundation: repository structure, dependency manifests, Docker service topology, environment templates, and core engineering documentation. Backend and frontend runtime code begins in later sprints, so this sprint is intentionally focused on design and setup.

## Core Features

- Secure user registration, login, logout, and current-user profile retrieval
- JWT authentication with bcrypt password hashing and Redis-backed token blacklist
- Public and private chat rooms with membership validation
- Real-time messaging over Socket.io
- Message persistence in MongoDB with Redis caching for recent room history
- Online user presence, typing indicators, and room join/leave events
- Azure Service Bus publishing for reliable message delivery workflows
- Docker Compose local environment with Node.js, MongoDB, and Redis
- Jest, Supertest, and React Testing Library test coverage across backend and frontend

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TailwindCSS, React Router, Axios |
| Backend | Node.js, Express.js |
| Real-time | Socket.io |
| Authentication | JWT, bcrypt |
| Database | MongoDB, Mongoose |
| Cache and presence | Redis, ioredis |
| Messaging reliability | Azure Service Bus |
| Testing | Jest, Supertest, React Testing Library |
| DevOps | Docker, Docker Compose |

## Architecture Summary

The browser client authenticates through REST endpoints and then opens a Socket.io connection using the JWT. The server validates the token, joins users to chat rooms, persists messages to MongoDB, caches recent room history in Redis, emits real-time updates to connected clients, and publishes message delivery records to Azure Service Bus.

```text
React Client -> Express REST API -> MongoDB
React Client -> Socket.io Server -> Redis
Socket.io Server -> Azure Service Bus
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- Docker Desktop
- A MongoDB connection string for non-Docker deployments
- A Redis instance for non-Docker deployments
- Azure Service Bus namespace and queue for production-grade delivery workflows

## Local Setup

Install backend dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
```

Prepare environment variables:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

For Sprint 1, dependency installation and documentation are the verified deliverables. Runtime startup begins when the backend server is implemented in Sprint 2.

## Docker Services

The initial Docker Compose file defines:

- `server`: Node.js API and Socket.io service
- `mongo`: MongoDB 7 with persistent local volume
- `redis`: Redis 7 with append-only persistence

The application command becomes fully runnable after Sprint 2 introduces the backend entry point:

```bash
docker compose up --build
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment: `development`, `test`, or `production` |
| `PORT` / `SERVER_PORT` | Backend HTTP port |
| `CLIENT_URL` | Allowed browser client origin |
| `JWT_SECRET` | Secret used to sign and verify JWTs |
| `JWT_EXPIRES_IN` | Access-token lifetime |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost factor |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection location |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | Azure Service Bus namespace credential |
| `AZURE_SERVICE_BUS_QUEUE_NAME` | Queue used for message delivery events |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth route rate-limit window |
| `AUTH_RATE_LIMIT_MAX` | Maximum auth attempts per window |

## Project Structure

```text
chatterbox/
├── docs/
├── server/
│   ├── src/
│   ├── tests/
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── client/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Documentation

- [Software Requirements Specification](docs/SRS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Specification](docs/API_SPEC.md)
- [Database Schema](docs/DB_SCHEMA.md)
- [Test Plan](docs/TEST_PLAN.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Sprint Log](docs/SPRINT_LOG.md)

## Sprint Roadmap

| Sprint | Focus |
| --- | --- |
| 1 | Project foundation and documentation |
| 2 | Backend auth, database models, server, and auth tests |
| 3 | Socket.io engine, rooms, Redis caching, and Azure Service Bus |
| 4 | React auth flow and polished chat interface |
| 5 | Testing, validation, error handling, pagination, and performance |
| 6 | Production Docker setup, CI, deployment docs, and final polish |

## License

MIT License. This project is built as a portfolio system by Shriya Patel.
