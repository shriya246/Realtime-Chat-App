<!-- Purpose: Final system architecture, data flow, security, caching, and deployment design for ChatterBox. -->

# System Architecture

## 1. Overview

ChatterBox is a container-ready real-time chat system. A React single-page application is built by Vite and served by Nginx. Its REST and Socket.io traffic reaches a Node.js/Express server that owns authentication, authorization, room behavior, message persistence, live fan-out, caching, and queue publication. MongoDB is durable truth; Redis stores transient fast-access state; Azure Service Bus accepts downstream delivery events.

## 2. Component Diagram

```text
                         Browser
                            |
                            | HTTP / WebSocket
                            v
                    +-------+--------+
                    | Nginx Client   |
                    | React SPA      |
                    +-------+--------+
                            |
                    REST + Socket.io/JWT
                            |
                    +-------v--------+
                    | Node.js Server |
                    | Express/Socket |
                    +---+------+-----+
                        |      | \
               Mongoose |      |  \ delivery events
                        |      |   \
                   +----v--+ +-v-----+ +-------------------+
                   |MongoDB| | Redis | | Azure Service Bus |
                   +-------+ +-------+ +-------------------+
```

## 3. Responsibilities

| Component | Responsibility |
| --- | --- |
| Nginx client container | Serves optimized static files, immutable asset caching, health route, and SPA route fallback. |
| React client | Manages authentication UI, rooms, messages, presence, typing, reconnect state, and queued outgoing messages. |
| Express API | Validates REST requests and handles authentication, users, rooms, history pagination, health, and consistent errors. |
| Socket.io engine | Authenticates handshakes, joins rooms, broadcasts messages/presence/typing, and responds with recent history. |
| MongoDB/Mongoose | Persists users, rooms, and messages with indexes and schema validation. |
| Redis/ioredis | Caches recent messages, tracks online users, and blacklists revoked JWTs. |
| Azure Service Bus | Receives asynchronous delivery events after a message is accepted and persisted. |

## 4. Technology Decisions

| Technology | Decision rationale |
| --- | --- |
| React and Vite | Responsive component architecture with fast local workflow and optimized production builds. |
| TailwindCSS | Consistent compact chat workspace styling across desktop and mobile layouts. |
| Express | Mature middleware model for validation, security headers, logging, and REST resources. |
| Socket.io | Authenticated rooms, acknowledgement callbacks, reconnection support, and browser compatibility. |
| MongoDB and Mongoose | Natural document relationships for chat data with compound message history indexes. |
| Redis | Low-latency expiring state for presence, recent history, and revoked access tokens. |
| Azure Service Bus | Managed durable event boundary for notification, replay, auditing, or analytics workers. |
| Docker Compose and Nginx | Reproducible topology and efficient production SPA delivery. |

## 5. Authentication and Authorization

1. Registration validates username, email, and password input.
2. Mongoose hashes the password with bcrypt before storing the user.
3. Login compares bcrypt hashes and signs a JWT from `JWT_SECRET`.
4. The React session stores the token and sanitized user; Axios sends the bearer token.
5. REST middleware verifies the token, rejects Redis-blacklisted tokens, and attaches the user.
6. Socket.io accepts the token through the handshake, applies equivalent checks, and attaches the authenticated user to the socket.
7. Logout stores a Redis blacklist key until the token's remaining expiration.

Private rooms enforce member access for REST history and socket joins/messages. Public rooms remain visible and joinable to authenticated users.

## 6. Message Delivery Flow

```text
Client send_message
  -> validate authenticated socket, room access, and content
  -> persist Message in MongoDB
  -> LPUSH serialized message into Redis messages:<roomId>
  -> LTRIM bounded recent history and apply expiry
  -> emit receive_message to active room sockets
  -> publish delivery event to Azure Service Bus
```

Queue publication occurs after persistence. A Service Bus error does not roll back or hide a message already delivered live; it produces a controlled server error log and a failed publication outcome for monitoring.

## 7. History and Redis Strategy

| Redis key | Value | Expiration | Use |
| --- | --- | --- | --- |
| `messages:<roomId>` | Newest-first JSON message list | `MESSAGE_CACHE_TTL_SECONDS`, default 86400 seconds | Fast latest-history response on room join |
| `online:<userId>` | Presence JSON payload | `ONLINE_USER_TTL_SECONDS`, default 3600 seconds | Current online list and stale presence cleanup |
| `blacklist:<token>` | Revocation marker | Remaining JWT lifetime | Immediate logout invalidation |

When `join_room` is received, the server reads up to `MESSAGE_HISTORY_LIMIT` messages from Redis. A miss queries MongoDB and warms the bounded Redis list. When private-room membership changes, cached history is invalidated so access changes are reflected through an authoritative reload.

`GET /api/rooms/:id/messages` provides longer history with an `_id` cursor. The indexed MongoDB query avoids page-offset scans and returns messages chronologically for rendering.

## 8. Presence, Typing, and Resilience

- On connection, an authenticated user is stored online in Redis and broadcast through `user_online`.
- Multiple sockets for one user share an internal Socket.io room; the user goes offline only after the final socket disconnects.
- Typing indicators are transient socket broadcasts with a three-second auto-clear timer.
- The client reconnects with exponential backoff after transport loss.
- The client queues up to 100 messages in memory while disconnected, marks them queued in the interface, and replays after successful reconnect and room rejoin.

The outgoing queue intentionally is not persisted in browser storage, avoiding storage of unsent message content across sessions.

## 9. Centralized Configuration and Security

`server/src/config/index.js` owns parsing and validation of runtime configuration. Production startup fails early when `JWT_SECRET`, `MONGO_URI`, `CORS_ALLOWED_ORIGINS`, or `AZURE_SERVICE_BUS_CONNECTION_STRING` is absent.

| Control | Implementation |
| --- | --- |
| Credential storage | Passwords hashed with bcrypt; JWT secret supplied only by environment/secret manager. |
| Input safety | express-validator routes plus Mongoose schema constraints. |
| HTTP protection | Helmet security headers, body-size limit, response compression, and CORS allowlist. |
| Brute-force protection | Rate limiter on auth routes. |
| Request visibility | Morgan method/status/latency logging without credential logging. |
| Container privilege | API image runs under a dedicated non-root user. |
| Browser delivery | Nginx static delivery with asset cache policy and SPA fallback. |

## 10. Frontend Modules

```text
App
|-- AuthProvider
|   |-- LoginPage
|   |-- RegisterPage
|   `-- protected ChatPage
`-- SocketProvider
    `-- ChatPage
        |-- Sidebar (rooms, presence, create room)
        `-- ChatWindow (history, send, typing, delivery state)
```

| Module | Role |
| --- | --- |
| `AuthContext` | Restores, creates, and destroys authenticated sessions. |
| `SocketContext` | Owns authenticated real-time connection and reconnection state. |
| `useMessages` | Room lifecycle, history/events, typing, optimistic sends, and queued replay. |
| `useOnlineUsers` | Reduces online/offline events into visible presence state. |
| `api.js` | Sets API URL, attaches JWT headers, and clears invalid sessions on `401`. |

## 11. Deployment Architecture

```text
Docker Compose
|-- client: Nginx serving Vite bundle on host port 3000
|       `-- starts after healthy server
|-- server: non-root Node.js runtime on host port 5000
|       |-- waits for healthy MongoDB and Redis
|       `-- publishes to external Azure Service Bus
|-- mongo: MongoDB 7 with persistent volume
`-- redis: Redis 7 with append-only persistent volume
```

The production Compose override requires service secrets, sets reverse-proxy awareness, and establishes container resource budgets. In managed hosting, the two application images can be deployed independently while MongoDB Atlas, Redis Cloud, and Azure Service Bus provide managed state.

## 12. Health and Failure Behavior

| Failure | Behavior |
| --- | --- |
| Invalid/expired/revoked JWT | REST returns `401`; socket handshake is rejected. |
| Unauthorized private-room operation | REST or socket response reports authorization failure. |
| MongoDB or Redis not ready | `/api/health` responds `503` with `status: "degraded"`. |
| Redis operation fails during workflow | The operation fails in a controlled path; durable MongoDB records are not silently rewritten. |
| Azure Service Bus publish fails | Saved/live message remains accepted; publication failure is reported for monitoring. |
| Socket transport disconnects | Presence cleanup executes and active clients may reconnect/replay queued in-session sends. |

## 13. Scaling Path

The portfolio delivery runs one Node.js instance. Horizontal production scaling would add the Socket.io Redis adapter for cross-instance broadcasts, multiple API replicas behind a load balancer, managed MongoDB/Redis resiliency policies, Service Bus consumers with dead-letter monitoring, and metrics/tracing for queue and socket behavior.
