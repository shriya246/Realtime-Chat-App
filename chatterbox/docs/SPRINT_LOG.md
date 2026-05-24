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
