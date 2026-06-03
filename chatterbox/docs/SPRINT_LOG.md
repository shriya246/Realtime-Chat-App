<!-- Purpose: Sprint-by-sprint progress log for ChatterBox. -->

# Sprint Log

## Project Summary

| Field | Detail |
| --- | --- |
| Developer | Shriya Patel |
| Product | ChatterBox - real-time portfolio chat application |
| Delivery period | Six v1 sprints completed on 2026-05-24 and 2026-05-25; v2.0 direct messaging and v2.5 media/profile upgrades completed on 2026-05-31; v3.0 privacy/group and v4.0 calls/status/channels upgrades completed on 2026-06-02 |
| Delivered system | React/Nginx client, Node.js API and Socket.io engine, direct conversations, managed groups, WebRTC 1:1 calls, statuses, channels, local media uploads, voice notes, notifications, profiles, privacy settings, session management, locked chats, disappearing messages, local reports, admin dashboard, MongoDB persistence, Redis cache/presence, local no-op event publishing with optional Azure, Docker deployment, and CI |
| Verification | 68 backend tests, 30 frontend tests, production build, and Docker Compose config validation |

### Key Engineering Decisions

- Store durable chat state in MongoDB while limiting Redis to expiring acceleration, presence, and JWT revocation data.
- Use authenticated Socket.io rooms for live traffic and cursor-indexed REST retrieval for deeper history.
- Publish accepted delivery events through a local no-op publisher by default, with optional Azure Service Bus only when explicitly enabled.
- Centralize configuration validation and require production secrets/integration endpoints before the API begins serving.
- Ship a non-root API image and an Nginx-served static client with dependency health-gated Compose startup.

### Lessons Learned

- Validating configuration as code and testing its production failure paths prevents deployment surprises.
- Redis caching needs explicit invalidation when authorization-affecting membership state changes.
- Connection recovery is a user-visible feature: bounded queued state gives clear feedback without persisting unsent content.
- Container health gates turn infrastructure ordering into a repeatable, testable deployment behavior.

## Sprint 9 - v3.0.0 Privacy, Groups, Moderation, and Encryption Demo

| Field | Detail |
| --- | --- |
| Date | 2026-06-02 |
| Goal | Upgrade ChatterBox to v3.0.0 with privacy controls, WhatsApp-style group management, moderation, disappearing messages, locked chats, and a client-side encryption demo. |
| Process phase | Backend implementation, frontend implementation, testing, documentation, and versioning |
| Status | Completed |

### Deliverables Completed

- Set server and client package versions to `3.0.0`.
- Enhanced rooms into managed groups with description, avatar reference, owner/admin/member roles, member add/remove, admin promote/demote, leave, delete, group settings, and group details UI.
- Added invite-token flow with reset/revoke support and optional join approval requests.
- Added group settings for admins-only sending, group-info edit permissions, disappearing messages, and whether new members can see recent history.
- Added direct and group disappearing-message modes: `off`, `24h`, `7d`, and `90d`; messages store `expiresAt`, APIs filter expired messages, and a local server interval emits `message:expired`.
- Added user block/unblock and local report creation with an admin-only moderation report list.
- Added per-user locked-chat settings, bcrypt-hashed local PIN storage, and password/PIN unlock for protected direct-message history.
- Added privacy settings for last seen, online status, read receipts, profile photo, and about visibility.
- Added a browser Web Crypto client-side encryption demo for direct chats. Encrypted demo messages store ciphertext and metadata on the server while local demo keys stay in browser `localStorage`.
- Added Socket.io events for group admin operations, disappearing/encryption settings, block/report, locked chats, and message expiry.
- Preserved v1 room chat, v2 direct-message behavior, and v2.5 media/profile/notification features.
- Added backend and frontend tests for v3 behavior and updated documentation, including `docs/PRIVACY_AND_SECURITY.md`.

### Decisions Made

- Keep all v3 behavior free/local/open-source/browser-native: MongoDB, Redis, local uploads, bcrypt, Socket.io, browser Notification API, browser MediaRecorder API, browser Web Crypto, and a local Node cleanup interval.
- Document locked chats as web-app-level privacy rather than device or biometric security.
- Treat encryption as a portfolio demo, not production-grade WhatsApp E2EE; no Signal protocol, secure key exchange, forward secrecy, or protected key storage is claimed.
- Store reports locally in MongoDB and avoid paid moderation or identity providers.
- Keep optional Azure Service Bus disabled by default through `EVENT_PUBLISHER=noop`.

### Verification

- Backend tests cover group admin authorization, add/remove/promote/demote, invite and join approval, disappearing-message filtering, block prevention, report creation/admin listing, locked-chat unlock flow, and encrypted ciphertext storage.
- Frontend tests cover group details/admin UI, disappearing-message controls, block/report actions, locked-chat unlock UI, encrypted demo warning/send state, and privacy settings.
- Latest local results: 61 backend tests passed across 10 suites with coverage above the 80% threshold; 25 frontend tests passed across 8 suites; client production build passed.

### Review Notes

- Disappearing-message cleanup runs in the Node server process. A multi-instance deployment would need coordinated scheduling or idempotent worker ownership.
- Locked chats protect the app UI/history endpoint after logout/relock, but do not defend against a compromised active browser session.
- Encryption demo keys live in `localStorage`, so this is intentionally not production E2EE.

## Sprint 10 - v4.0.0 Calls, Status, Channels, Scaling, and E2E

| Field | Detail |
| --- | --- |
| Date | 2026-06-02 |
| Goal | Upgrade ChatterBox to v4.0.0 with WebRTC calls, status/stories, channels, session management, scaling improvements, observability dashboard, and E2E tests. |
| Process phase | Backend implementation, frontend implementation, testing, documentation, and versioning |
| Status | Completed |

### Deliverables Completed

- Set server and client package versions to `4.0.0`.
- Added Socket.io WebRTC signaling for 1:1 voice/video calls with offer, answer, ICE, ringing, accepted, rejected, ended, and missed states.
- Added direct chat call buttons and browser-native call overlay with incoming call, active call, mute, camera toggle, and end call controls.
- Added status/stories model and API for text/image/video statuses with 24-hour expiry, viewers, and local cleanup.
- Added channels/broadcasts with owner/admin posting, followers, discovery/search, posts, and emoji reactions.
- Added session records for browser/device foundation with active session listing and logout-all-other-sessions support.
- Added optional Redis Socket.io adapter configuration plus Docker Compose `scale` profile for local scaling experiments.
- Added local background worker module for disappearing-message and status cleanup.
- Added internal admin dashboard and Prometheus-compatible local metrics endpoint.
- Added optional Playwright E2E specs for register/login, direct chat message, and group creation.

### Decisions Made

- Use browser-native WebRTC and Socket.io signaling only; no Twilio, Agora, Daily, Vonage, Firebase, or paid call provider.
- Keep v4 calls 1:1 only and document group calls as a future SFU integration area.
- Keep observability local with MongoDB aggregations, Redis health, and optional text metrics instead of paid monitoring.
- Keep E2E tests optional in CI because browser installation and full-stack startup increase runtime.

### Verification

- Backend tests cover call signaling authorization, status creation/expiry, channel create/follow/post, session logout-all, Redis adapter fallback, and dashboard authorization.
- Frontend tests cover call modal UI, status panel, channel panel, session management modal, and admin dashboard panel.
- Playwright specs exist for three reliable local flows and are documented in `docs/E2E_TESTING.md`.
- Latest local results: 68 backend tests passed across 11 suites with coverage above the 80% threshold; 30 frontend tests passed across 9 suites; client production build, server syntax check, and Docker Compose config validation passed.

## Sprint 8 - v2.5.0 Media Messaging, Profiles, and Chat Controls

| Field | Detail |
| --- | --- |
| Date | 2026-05-31 |
| Goal | Upgrade ChatterBox to v2.5.0 with WhatsApp-style media messages, voice notes, notifications, profiles, pinned/archived/muted chats, and scoped search. |
| Process phase | Backend implementation, frontend implementation, testing, documentation, and versioning |
| Status | Completed |

### Deliverables Completed

- Set server and client package versions to `2.5.0`.
- Added an `Attachment` model and local filesystem storage service for media metadata and bytes.
- Added upload configuration with `UPLOAD_DIR` and `MAX_UPLOAD_FILE_SIZE_BYTES`, plus Docker `server-uploads` persistence.
- Added protected attachment upload and content-serving endpoints with MIME allowlists, file-size checks, executable rejection, and participant-only access for message attachments.
- Extended direct messages to support `text`, `image`, `video`, `file`, and `audio` message types with attachment metadata.
- Added voice-note UI using the browser `MediaRecorder` API with start/stop/cancel/send flow, timer, preview, and fallback behavior.
- Added browser Notification API permission control and notification dispatch for hidden-tab or inactive-conversation messages while respecting muted chats.
- Added profile editing for `displayName`, `about`, and local avatar uploads; avatars render in the sidebar, chat header, messages, and profile modal with initials fallback.
- Added per-user conversation settings for pinned, archived, and muted chats with sidebar controls and archived grouping.
- Added conversation-scoped message search through a protected REST endpoint and direct chat search UI.
- Added Socket.io handling for media messages, profile updates, and conversation settings updates.
- Preserved v1 room chat and all v2.0 direct-message features.
- Updated README, API, architecture, database schema, deployment, test plan, sprint log, environment examples, Docker Compose, and upload ignore rules.

### Decisions Made

- Use local filesystem storage for development and Docker Compose while hiding it behind a storage service abstraction for future cloud adapters.
- Keep all new features free/local/browser-native: browser Notification API, browser MediaRecorder API, local uploads, MongoDB, Redis, and no paid media or push provider.
- Keep Azure Service Bus optional and disabled by default with `EVENT_PUBLISHER=noop`.
- Store per-user chat controls in the conversation document instead of creating a separate settings collection, keeping direct-chat list reads simple.
- Scope message search to one authorized conversation and use safe MongoDB queries with limits rather than adding an external search service.

### Verification

- Backend tests cover allowed upload, disallowed upload, attachment authorization, profile update, chat settings, and message search authorization.
- Existing backend tests still cover auth, rooms, direct conversations, unread counts, read receipts, reactions, and edit/delete authorization.
- Frontend tests cover attachment preview/upload, voice recorder fallback, notification permission control, profile avatar rendering, pinned/muted/archive behavior, direct chat, reaction UI, reply preview, and preserved room chat components.
- Latest local results: 49 backend tests passed across 9 suites with coverage above the 80% threshold; 19 frontend tests passed across 6 suites.

### Review Notes

- Uploaded media remains local to the server filesystem or Docker volume. Production deployments should back up that volume or replace the storage service with a future cloud adapter.
- Browser notifications require the app to be open in the browser; web push service workers are outside v2.5.0.
- Voice note capture depends on browser support for `MediaRecorder` and microphone permission.

## Sprint 7 - v2.0.0 WhatsApp-Style Direct Messaging

| Field | Detail |
| --- | --- |
| Date | 2026-05-31 |
| Goal | Upgrade ChatterBox to v2.0.0 with one-to-one direct conversations and a WhatsApp-style chat experience while preserving room chat. |
| Process phase | Product upgrade, backend implementation, frontend implementation, testing, and documentation |
| Status | Completed |

### Deliverables Completed

- Set server and client package versions to `2.0.0`.
- Added a `Conversation` model for exactly two participants with a unique sorted participant key to prevent duplicate direct chats.
- Extended `Message` records for direct conversations, replies, reactions, delivered/read receipts, edited timestamps, soft delete, and optional per-user hidden state.
- Added protected REST endpoints for direct conversation create/get, list, direct-message history, and mark-as-read.
- Added Socket.io events for `direct_message:send`, `direct_message:new`, `message:delivered`, `message:read`, `message:reaction:update`, `message:edit`, `message:delete`, and `conversation:updated`.
- Added server authorization so users can only read, join, send, react, edit, or delete messages in conversations they belong to.
- Added a WhatsApp-style sidebar with direct conversations, avatar placeholders, previews, timestamps, unread badges, online indicators, people search, and a preserved Rooms tab.
- Added a direct-chat window with optimistic sending states, failed-message retry, read receipt indicators, reply preview, quote scroll targeting, reaction picker, edit, and delete-for-everyone.
- Kept Azure Service Bus optional behind `EVENT_PUBLISHER=azure` and made `EVENT_PUBLISHER=noop` the default local/free event publisher.
- Updated README, API, architecture, schema, test plan, sprint log, environment examples, and Compose settings.

### Decisions Made

- Preserve room chat instead of replacing it; direct chats are the default v2 experience and rooms remain accessible through a separate sidebar tab.
- Use MongoDB for durable direct conversation state and Redis only for presence, room history cache, and token blacklist state.
- Compute unread counts from message read receipts so counts remain accurate even when multiple clients are open.
- Use simple emoji reactions and existing Lucide/browser-native UI controls; no paid media, storage, notification, or real-time service was introduced.
- Keep event publishing local and no-op by default so Docker Compose, tests, and CI remain free and self-contained.

### Verification

- Backend tests cover direct conversation creation, duplicate prevention, conversation listing, direct message send, unread counts, mark-as-read, reactions, and edit/delete authorization.
- Frontend tests cover conversation list rendering, direct chat opening, optimistic sending state, reply preview, reaction UI, and preserved room chat components.
- Full verification commands are recorded in the Test Plan and README.

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

## Sprint 3 - Real-Time Engine: Socket.io, Rooms, and Redis

| Field | Detail |
| --- | --- |
| Date | 2026-05-25 |
| Goal | Deliver authenticated room-based real-time messaging with persisted messages, cached history, presence tracking, typing indicators, protected room APIs, and Azure Service Bus delivery-event publishing. |
| Process phase | Design refinement, implementation, integration testing, and review |
| Status | Completed |

### Deliverables Completed

- Extended the Redis adapter with list operations and key scanning for recent-message cache and online-presence behavior, including deterministic in-memory test support.
- Extended `redisService` with bounded room message caching, cache retrieval, online presence registration/removal, and online-user retrieval.
- Added Azure Service Bus service integration for delivery-event publication, receiver subscription support, and graceful resource shutdown.
- Added protected room controller and routes for room creation, visible-room listing, authorized detail lookup, private-room member addition, and member departure.
- Mounted `/api/rooms` in the Express application.
- Added Socket.io server initialization with JWT handshake authentication and revoked-token enforcement.
- Added connection handling that stores presence, emits online/offline events, returns the online user list, and avoids false offline events while another user socket remains connected.
- Added room join/leave events with membership validation and recent history retrieval from Redis or MongoDB cache fallback.
- Added persisted `send_message` handling that caches recent delivery, broadcasts `receive_message`, and publishes delivery events to Azure Service Bus when configured.
- Added `user_typing` handling with `typing_indicator` emission and three-second auto-clear behavior.
- Bound Socket.io and Azure Service Bus shutdown handling into the HTTP server lifecycle.
- Added REST room integration tests and Socket.io end-to-end integration tests.
- Updated API, architecture, testing, environment, README, and sprint documentation.

### Decisions Made

- Keep MongoDB as durable message truth while Redis stores only the most recent room history for fast joins.
- Let public rooms accept any authenticated socket while enforcing explicit membership for private rooms.
- Require a socket to join a room before it can publish messages or typing activity there.
- Treat Azure Service Bus as a durable downstream delivery-event pipeline: missing local credentials skip publication safely, and transient queue failure does not discard an already-persisted live message.
- Track active sockets in internal per-user Socket.io rooms so opening multiple tabs does not produce incorrect offline presence.

### Verification

- `node --check` passed for all backend source and test files.
- `npm test` passed with 3 test suites and 15 total tests, including authenticated Socket.io integration scenarios.
- `npm audit --omit=dev` reported 0 production dependency vulnerabilities.

### Review Notes

- The server now exposes the backend capabilities required for the Sprint 4 React chat interface.
- Cursor-based message history REST pagination and broader cache-performance assertions remain planned for Sprint 5.

## Sprint 4 - React Frontend: Auth and Chat UI

| Field | Detail |
| --- | --- |
| Date | 2026-05-25 |
| Goal | Deliver a polished React client that authenticates users and consumes the Sprint 3 real-time backend through a responsive chat experience. |
| Process phase | UI design, implementation, build validation, and review |
| Status | Completed |

### Deliverables Completed

- Added Vite entry configuration, TailwindCSS/PostCSS configuration, Babel test transforms, browser entry document, and a client environment template.
- Added a restrained dark interface theme with reusable form, action, icon, scroll, and focus styles.
- Added session persistence utilities and date/time display helpers.
- Added an Axios service that attaches JWTs and clears invalid browser sessions after unauthorized responses.
- Added `AuthContext` for session restoration, login, registration, logout, and authentication state.
- Added `SocketContext` for authenticated Socket.io connection lifecycle and connection-status handling.
- Added `useSocket`, `useMessages`, and `useOnlineUsers` hooks for message history, optimistic sends, typing indicators, and live presence.
- Added login and registration views with browser and application validation plus readable error handling.
- Added protected React Router behavior that redirects guests to login and signed-in users into chat.
- Added the responsive `ChatPage` workspace with desktop sidebar and mobile navigation overlay.
- Added room navigation/search, create-room modal, online indicators, message bubbles, delivery states, typing display, and message composer components.
- Installed client dependencies and generated `client/package-lock.json`.
- Upgraded Vite and the React Vite plugin to current compatible releases after auditing the initial development toolchain.
- Updated README, architecture, deployment, and sprint documentation for the client workflow.

### Decisions Made

- Store only the signed JWT and sanitized user response in the browser session record, then validate it with the backend on startup.
- Make the selected room drive Socket.io joins and cleanly leave rooms during selection changes.
- Reconcile sent messages using `clientMessageId` so users see immediate optimistic updates without duplicate delivered messages.
- Keep operational chat UI dense and calm with responsive navigation instead of a marketing-style interface.
- Configure service endpoints at Vite build time through `VITE_API_BASE_URL` and `VITE_SOCKET_URL`.

### Verification

- `npm run build` succeeded for the React/Vite client.
- `npm audit` reported 0 client dependency vulnerabilities after the Vite toolchain upgrade.
- Existing backend validation remained green with `npm test`: 3 suites and 15 tests passed.
- The client development server launched on port `3000` and returned HTTP `200`.

### Review Notes

- Automated React Testing Library component suites and offline message replay/reconnection hardening are planned for Sprint 5.
- The UI expects the Sprint 3 backend at the configured REST and Socket.io URLs.

## Sprint 5 - Testing, Error Handling, and Performance

| Field | Detail |
| --- | --- |
| Date | 2026-05-25 |
| Goal | Harden API and client behavior under invalid inputs, disconnections, pagination, cache transitions, and infrastructure boundaries while meeting measured backend coverage goals. |
| Process phase | Hardening implementation, automated testing, coverage review, and documentation |
| Status | Completed |

### Deliverables Completed

- Added typed application error classes while retaining the consistent `{ success: false, error: { code, message, details } }` response contract.
- Added centralized `express-validator` chains for authentication, user queries, room operations, membership input, and message-history query parameters.
- Added Morgan request logging with status and response-time output outside automated tests.
- Added protected `GET /api/rooms/:id/messages` with indexed cursor-based pagination and access control.
- Added Redis room-history invalidation after private membership changes.
- Added optional `REDIS_CLUSTER_NODES` runtime configuration for managed clustered Redis deployments while preserving single-node local development and in-memory test behavior.
- Added explicit Socket.io exponential reconnection configuration and an in-memory outgoing-message queue that replays messages after successful reconnect and room rejoin.
- Added UI queued-delivery feedback and offline/reconnecting status labels.
- Expanded backend tests for auth validation, duplicate usernames, malformed and expired JWTs, unauthorized and invalid room cases, user endpoints, unknown routes, history cursors, cache warm/invalidation, Mongo connection retry, and Azure Service Bus behavior.
- Added React Testing Library tests for `LoginPage`, `MessageBubble`, and `ChatWindow`.
- Corrected the Jest transform configuration so client ES module and JSX source is executed by Babel during tests.

### Decisions Made

- Use MongoDB `_id` as the history cursor because it is indexed and naturally ordered for append-oriented message records.
- Invalidate room cache when membership changes instead of selectively filtering cached message payloads.
- Keep queued outgoing client messages in memory only, bounded to 100 entries, to avoid persisting unsent sensitive conversation content in browser storage.
- Make Redis Cluster opt-in through environment configuration so Docker local development remains simple.
- Enforce backend coverage thresholds on lines and statements at 80%, while continuing to improve branch depth in future work.

### Verification

- Backend `npm test -- --coverage --runInBand` passed with 31 tests in 6 suites.
- Backend measured coverage is 80.45% statements and 80.28% lines, meeting the enforced global 80% thresholds.
- Client `npm test -- --runInBand` passed with 8 tests in 3 suites.
- Client `npm run build` passed after the reconnect and queue changes.
- Full `npm audit` checks reported 0 vulnerabilities for both the server and client dependency trees.

### Review Notes

- Offline message replay handles transient transport outages within the active browser session; durable offline synchronization is not included in this portfolio scope.
- Production container hardening, final security middleware activation, CI, and deployment completion remain scheduled for Sprint 6.

## Sprint 6 - Docker, Deployment, and Final Polish

| Field | Detail |
| --- | --- |
| Date | 2026-05-25 |
| Goal | Deliver a secure, containerized, deployment-ready portfolio release with final documentation and verified startup behavior. |
| Process phase | Deployment design, implementation, verification, and final review |
| Status | Completed |

### Deliverables Completed

- Added centralized runtime configuration parsing and production required-variable validation in `server/src/config/index.js`.
- Wired MongoDB, Redis/cluster options, JWT, bcrypt, rate limits, caches, Socket.io origins, and Azure Service Bus through the central configuration contract.
- Enabled Helmet security headers and compression, configurable proxy handling, and dependency-aware `GET /api/health` behavior.
- Added configuration test coverage for parsing, malformed values, and required production settings.
- Replaced development Dockerfiles with multi-stage builds: a non-root production Node.js API image and an Nginx-served React image.
- Added Nginx SPA fallback, caching/security headers, and client container health endpoint.
- Finalized Compose with client, server, MongoDB, Redis, persistence, environment injection, dependency health gates, and restart behavior.
- Added a production Compose override with required deployment values and resource budgets.
- Added Docker build ignores, source-control ignores for local output/secrets, and GitHub Actions test/build/image CI.
- Rewrote README and deployment documentation for the final quickstart, API/events, environment variables, production operations, limitations, and future work.
- Updated architecture, API health contract, and final test evidence documentation.

### Decisions Made

- Apply HTTP security middleware in all runtime environments while requiring stricter integration values only for production startup.
- Keep Service Bus optional in every environment and disabled by default; production can enable it only when the deployer intentionally provides Azure credentials.
- Compile public API and Socket URLs into the client image through Vite build arguments.
- Leave the verified Docker stack running locally at completion so the portfolio application can be reviewed immediately.

### Verification

- `npm test -- --coverage --runInBand` in `server/` passed with 34 tests across 7 suites; statements reached 80.82% and lines reached 80.53%, satisfying enforced thresholds.
- `npm test -- --runInBand` in `client/` passed with 8 tests across 3 suites.
- `npm run build` in `client/` produced the optimized Vite production bundle.
- Base and production-override Docker Compose configurations validated successfully.
- `docker compose build` produced both final multi-stage application images.
- `docker compose up --detach` started all services; `client`, `server`, `mongo`, and `redis` reported healthy.
- `http://localhost:3000` served the React client with HTTP `200`; `http://localhost:5000/api/health` reported `status: "ok"`, MongoDB `ready`, and Redis `ready`.

### Review Notes

- The final local stack is runnable through Docker Compose and currently available on ports `3000` and `5000`.
- Horizontal Socket.io scale-out, durable client offline synchronization, and downstream Service Bus workers remain well-defined future enhancements rather than incomplete release behavior.
