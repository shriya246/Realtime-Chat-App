<!-- Purpose: Sprint-by-sprint progress log for ChatterBox. -->

# Sprint Log

## Sprint 1 - Project Foundation and Documentation

| Field | Detail |
| --- | --- |
| Date | 2026-05-24 |
| Goal | Establish the ChatterBox project skeleton, dependency manifests, environment templates, Docker service topology, and core documentation. |
| Process phase | Requirements, design, setup, and review |
| Status | Completed |

### Deliverables Completed

- Created the required `chatterbox/` project directory.
- Created `docs/`, `server/`, and `client/` folder structures.
- Added backend `package.json` with Express, Socket.io, MongoDB, Redis, JWT, bcrypt, Azure Service Bus, testing, and security-related dependencies.
- Added frontend `package.json` with React, Vite, TailwindCSS, Socket.io client, Axios, routing, icons, and testing dependencies.
- Added root and server environment example files.
- Added initial development Dockerfiles for server and client.
- Added Docker Compose configuration for Node server, MongoDB, and Redis.
- Wrote the Software Requirements Specification.
- Wrote the System Architecture document.
- Wrote the Database Schema document.
- Wrote the REST and Socket.io API specification.
- Wrote the initial Test Plan.
- Wrote the initial Deployment and Setup Guide.
- Wrote the project README.

### Decisions Made

- Use MongoDB as the source of truth and Redis only for cache, presence, and token blacklist state.
- Keep Socket.io authentication aligned with REST JWT verification.
- Cache the latest 50 room messages in Redis while retaining durable history in MongoDB.
- Publish accepted messages to Azure Service Bus after persistence for reliability and future worker workflows.
- Start with a single backend service locally while documenting a future horizontal scaling path.

### Review Notes

- Sprint 1 intentionally does not implement runtime application code.
- The repository is installable at the package level with `npm install` in `server/` and `client/`.
- Backend startup begins in Sprint 2 when Express app and server entry points are implemented.

## Sprint 2 - Backend Core: Auth, Database, and Server

| Field | Detail |
| --- | --- |
| Date | 2026-05-24 |
| Goal | Implement the working backend core with MongoDB configuration, Redis configuration, Mongoose models, JWT auth, REST routes, Express startup, graceful shutdown, and auth endpoint tests. |
| Process phase | Requirements refinement, implementation, testing, and review |
| Status | Completed |

### Deliverables Completed

- Added MongoDB connection management with Mongoose retry handling and graceful disconnect support.
- Added Redis configuration with ioredis for runtime environments and a test-safe in-memory adapter.
- Added `User`, `Room`, and `Message` Mongoose models with validation, indexes, virtuals, and sanitized JSON output.
- Added JWT utilities for signing, verification, and blacklist TTL calculation.
- Added Redis token blacklist service for logout and revoked-token enforcement.
- Added JWT authentication middleware that handles missing, expired, invalid, revoked, and deleted-user token cases.
- Added global error normalization with consistent JSON responses.
- Added auth route rate limiting.
- Added auth controller actions for register, login, logout, and current-user lookup.
- Added protected user search and profile routes.
- Added Express application setup with CORS, JSON parsing, health endpoint, and route mounting.
- Added HTTP server startup with MongoDB/Redis initialization and graceful shutdown handlers.
- Added Jest and Supertest auth coverage for registration, duplicate registration, login, wrong password, protected access, missing token, logout, and blacklist reuse.
- Installed backend dependencies and generated `package-lock.json`.
- Upgraded `bcrypt` to the current major version to remove the production audit issue from the older native prebuild dependency chain.

### Decisions Made

- Kept `app.js` free of port binding so Supertest can exercise the API without starting a listener.
- Centralized real network startup in `server.js`, where MongoDB, Redis, and graceful shutdown belong.
- Used MongoDB as the source of truth while Redis stores revoked-token state for the lifetime of each JWT.
- Used a Redis-compatible in-memory adapter only in `NODE_ENV=test` to keep auth tests deterministic without requiring a local Redis daemon.
- Returned safe auth errors for failed login attempts without revealing whether the email or password was incorrect.

### Verification

- `node --check` passed for all backend source and test files.
- `npm test` passed with 7 auth tests.
- `npm audit --omit=dev` reported 0 production vulnerabilities after the bcrypt upgrade.

### Review Notes

- The backend now runs through `npm start` or `npm run dev` when MongoDB and Redis are available.
- Socket.io, room CRUD, message persistence routes, Redis message caching, and Azure Service Bus message publishing are intentionally scheduled for Sprint 3.
