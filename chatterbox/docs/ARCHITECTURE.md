<!-- Purpose: System architecture document for ChatterBox. -->

# System Architecture

## 1. Overview

ChatterBox uses a split frontend/backend architecture. The React client handles authentication views and the chat interface. The Node.js backend exposes REST APIs for resource management and Socket.io events for real-time communication. MongoDB stores durable records, Redis accelerates presence and recent history lookups, and Azure Service Bus receives message delivery events for asynchronous reliability.

## 2. High-Level Component Diagram

```text
                       +-----------------------------+
                       |        React Client         |
                       |  Vite, TailwindCSS, Axios   |
                       +--------------+--------------+
                                      |
                         REST / JSON  |  Socket.io
                                      |
                       +--------------v--------------+
                       |       Node.js Backend       |
                       | Express API + Socket.io     |
                       +------+-----------+----------+
                              |           |
              Mongoose ODM    |           | ioredis
                              |           |
                      +-------v--+     +--v--------+
                      | MongoDB  |     | Redis     |
                      | Durable  |     | Cache and |
                      | storage  |     | presence  |
                      +----------+     +-----------+
                              |
                              | delivery events
                              v
                      +-------------------+
                      | Azure Service Bus |
                      | Queue pipeline    |
                      +-------------------+
```

## 3. Component Responsibilities

| Component | Responsibility |
| --- | --- |
| React client | Presents login, registration, room list, chat window, typing indicators, and presence states. |
| Express API | Handles authentication, user search, room management, message history, validation, and error formatting. |
| Socket.io server | Authenticates socket connections, joins/leaves rooms, emits messages, and broadcasts presence events. |
| MongoDB | Stores users, rooms, and messages as the source of truth. |
| Redis | Stores token blacklist entries, online user presence, and cached recent room messages. |
| Azure Service Bus | Receives message delivery events for future replay, audit, worker processing, and reliability workflows. |

## 4. Technology Choices

| Technology | Reason |
| --- | --- |
| React with Vite | Fast local development, strong ecosystem, and excellent portfolio visibility. |
| TailwindCSS | Utility-first styling that supports responsive polished interfaces without large custom CSS files. |
| Express | Stable Node.js API framework with straightforward middleware composition. |
| Socket.io | Reliable WebSocket abstraction with rooms, reconnection support, and event-driven semantics. |
| MongoDB and Mongoose | Flexible document model suited to users, rooms, and chat messages with schema validation and indexes. |
| Redis | Low-latency cache for presence, token blacklist, and recent message history. |
| Azure Service Bus | Managed queue for durable asynchronous delivery events and production cloud architecture discussion. |
| Docker Compose | Repeatable local infrastructure for MongoDB, Redis, and the API server. |

## 5. Authentication Flow

1. A guest submits registration or login credentials through the React client.
2. Express validates input and checks uniqueness or credential correctness.
3. Passwords are hashed with bcrypt on registration.
4. The backend signs a JWT using `JWT_SECRET`.
5. The frontend stores the token in localStorage and attaches it to API requests.
6. Protected REST routes verify the JWT and check Redis to ensure the token has not been blacklisted.
7. Socket.io connections pass the JWT in the handshake and are rejected if verification fails.

## 6. Real-Time Message Flow

1. A user joins a room through `join_room`.
2. The server validates room membership.
3. The socket joins the Socket.io room.
4. The server loads recent messages from Redis using `messages:<roomId>`.
5. If Redis misses, the server queries MongoDB, returns the latest 50 messages, and warms the Redis cache.
6. A user emits `send_message` with room ID and content.
7. The server validates content and membership.
8. The message is saved to MongoDB.
9. The message is cached in Redis and the list is trimmed to the latest 50 items.
10. The message is emitted to all sockets in that room through `receive_message`.
11. A delivery event is published to Azure Service Bus.

## 7. Redis Caching Strategy

| Key pattern | Data | TTL | Purpose |
| --- | --- | --- | --- |
| `online:<userId>` | ISO timestamp or socket metadata | 3600 seconds refreshed on activity | Tracks online presence. |
| `messages:<roomId>` | Redis list of serialized messages | 86400 seconds | Fast retrieval of recent room history. |
| `blacklist:<tokenId>` or `blacklist:<token>` | Token marker | Remaining JWT lifetime | Prevents reuse of logged-out tokens. |
| `typing:<roomId>:<userId>` | Temporary typing marker | 3 seconds | Supports auto-clearing typing indicators. |

Redis is not the source of truth. If Redis is empty or unavailable, MongoDB is used for durable message reads.

## 8. Azure Service Bus Role

Azure Service Bus is used after a message is accepted and persisted. The queue receives a delivery event containing message ID, room ID, sender ID, timestamp, and status. This enables future production patterns such as:

- delivery replay after transient failures
- analytics or audit consumers
- notification workers
- dead-letter handling for failed downstream operations

The chat path remains responsive because queue publication is handled as a controlled service call with error handling.

## 9. Data Flow by Feature

| Feature | Client | Backend | Data stores |
| --- | --- | --- | --- |
| Register | POST credentials | Validate, hash, create user, sign JWT | MongoDB user |
| Login | POST credentials | Validate password, sign JWT | MongoDB user, Redis blacklist check |
| Logout | POST token | Add token to blacklist | Redis blacklist key |
| Create room | POST room details | Validate name/type, create room | MongoDB room |
| Join room | Socket event | Validate membership, join socket room | MongoDB room, Redis message cache |
| Send message | Socket event | Validate, save, emit, queue | MongoDB message, Redis message list, Azure Service Bus |
| Presence | Socket connect/disconnect | Set/delete online key, broadcast | Redis online key |

## 10. Security Architecture

- JWTs are signed with environment-provided secrets.
- bcrypt stores only password hashes.
- Protected REST and Socket.io paths share token verification rules.
- Auth endpoints are rate limited.
- CORS is restricted by environment configuration.
- Helmet and compression are added during production hardening.
- Sensitive values are documented in `.env.example` but real secrets are never committed.

## 11. Scalability Considerations

The first portfolio version runs as a single backend instance. The architecture deliberately separates durable state and cache state so the application can later scale horizontally with:

- Redis-backed Socket.io adapter for cross-instance room events
- MongoDB Atlas replica set for managed durability
- Redis Cloud for managed cache and presence storage
- Azure Service Bus consumers for independent background processing
- Load balancer routing to multiple Node.js containers

## 12. Failure Handling

| Failure | Expected behavior |
| --- | --- |
| Invalid JWT | REST returns `401`; Socket.io rejects connection. |
| Redis unavailable | Application logs service error and falls back to MongoDB where possible. |
| MongoDB unavailable | API returns controlled `503` or `500` response depending on failure type. |
| Azure Service Bus unavailable | Message remains saved and emitted; queue failure is logged without crashing the server. |
| Client disconnect | Socket.io disconnect handler clears presence and emits `user_offline`. |

## 13. Final Deployment Shape

Sprint 6 will extend this architecture with an Nginx-served client container, production Docker Compose overrides, health checks, security middleware, and CI validation. The core deployment path remains:

```text
Browser -> Client container -> API container -> MongoDB / Redis / Azure Service Bus
```
