<!-- Purpose: Software Requirements Specification for the ChatterBox portfolio chat application. -->

# Software Requirements Specification

## 1. Project Identification

| Field | Value |
| --- | --- |
| Project | ChatterBox |
| Developer | Shriya Patel |
| Document version | 1.0 |
| Initial date | 2026-05-24 |
| Primary goal | Build a production-grade real-time chat system for a software engineering portfolio |

## 2. Purpose

ChatterBox is a real-time chat application that demonstrates full-stack engineering across authentication, API design, WebSocket communication, persistent storage, caching, asynchronous delivery workflows, testing, and containerized deployment.

The system is intended to show that Shriya can design and implement a scalable distributed application using technologies commonly found in production environments.

## 3. Scope

The application will allow authenticated users to create or join rooms, send messages, view recent message history, see who is online, and receive typing indicators. The backend will expose REST APIs for authentication and resource management, while Socket.io will power low-latency room communication.

### In Scope

- User registration and login
- JWT-based authentication
- Password hashing with bcrypt
- Authenticated REST APIs for users and rooms
- Socket.io authentication and room events
- MongoDB persistence for users, rooms, and messages
- Redis caching for message history, online users, and token blacklist
- Azure Service Bus publishing for message delivery reliability
- Docker Compose local environment
- Automated backend and frontend tests
- Complete engineering documentation

### Out of Scope for Initial Portfolio Version

- End-to-end encryption
- Voice and video chat
- Push notifications
- File uploads
- Payment or subscription features
- Administrative moderation dashboard

## 4. Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Shriya Patel | Portfolio-quality engineering artifact and interview discussion project |
| Recruiters and hiring managers | Evidence of scalable full-stack implementation skill |
| Technical interviewers | Clear architecture, testability, tradeoff reasoning, and readable code |
| End users | Secure and responsive chat experience |

## 5. User Classes

| User class | Description |
| --- | --- |
| Guest | Unauthenticated visitor who can register or log in |
| Authenticated user | User who can view rooms, join rooms, send messages, and see presence |
| Room member | Authenticated user with permission to access a public or private room |

## 6. Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-001 | The system shall allow a guest to register with username, email, and password. | Must |
| FR-002 | The system shall reject duplicate email addresses and duplicate usernames. | Must |
| FR-003 | The system shall hash passwords before storing users in MongoDB. | Must |
| FR-004 | The system shall allow registered users to log in with email and password. | Must |
| FR-005 | The system shall issue a signed JWT after successful registration or login. | Must |
| FR-006 | The system shall protect private REST routes with JWT middleware. | Must |
| FR-007 | The system shall allow users to log out by blacklisting the active JWT in Redis. | Must |
| FR-008 | The system shall allow authenticated users to search user profiles. | Should |
| FR-009 | The system shall allow users to create public or private chat rooms. | Must |
| FR-010 | The system shall allow users to list rooms they can access. | Must |
| FR-011 | The system shall allow room members to join and leave rooms over Socket.io. | Must |
| FR-012 | The system shall deliver messages to all connected room members in real time. | Must |
| FR-013 | The system shall persist every valid message in MongoDB. | Must |
| FR-014 | The system shall cache the latest 50 messages per room in Redis. | Must |
| FR-015 | The system shall return recent message history when a user joins a room. | Must |
| FR-016 | The system shall publish message delivery records to Azure Service Bus. | Should |
| FR-017 | The system shall emit typing indicators to other room members. | Should |
| FR-018 | The system shall track online users through Redis presence keys. | Must |
| FR-019 | The frontend shall redirect unauthenticated users away from protected chat routes. | Must |
| FR-020 | The frontend shall provide responsive desktop and mobile chat layouts. | Must |

## 7. User Stories

| ID | Story | Acceptance Criteria |
| --- | --- | --- |
| US-001 | As a guest, I want to register so I can access chat rooms. | Valid username, email, and password create an account and return a JWT plus sanitized user object. |
| US-002 | As a user, I want to log in so I can resume chatting. | Correct credentials return a JWT; incorrect credentials return a safe error without revealing which field failed. |
| US-003 | As a user, I want to send a message so room members can see it immediately. | Message is validated, saved to MongoDB, cached in Redis, emitted to the room, and published to the queue. |
| US-004 | As a user, I want to join a room so I can participate in its conversation. | Membership is validated, the socket joins the room, and recent history is returned. |
| US-005 | As a user, I want to see online users so I know who is available. | Online status updates appear when users connect and disappear when they disconnect. |
| US-006 | As a user, I want to view message history so I have conversation context. | The latest room messages load from Redis when possible and MongoDB otherwise. |
| US-007 | As a user, I want typing indicators so conversations feel live. | Other room members see a temporary typing state when a user is composing a message. |

## 8. Non-Functional Requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-001 | Performance | REST endpoints should respond within 300 ms for normal local-development workloads excluding cold starts. |
| NFR-002 | Performance | Socket message fanout should occur within 150 ms after server receipt in local development. |
| NFR-003 | Scalability | Room messaging logic shall be stateless enough to support multiple server instances with Redis and Socket.io adapters in future versions. |
| NFR-004 | Security | Passwords must never be logged or returned in API responses. |
| NFR-005 | Security | JWT secrets and service credentials must only come from environment variables. |
| NFR-006 | Security | Auth routes must be rate limited to reduce brute-force attempts. |
| NFR-007 | Reliability | MongoDB writes must be awaited before successful message acknowledgement. |
| NFR-008 | Reliability | Azure Service Bus publishing failures must be handled without crashing the request or socket process. |
| NFR-009 | Maintainability | Code should be organized by responsibility: config, controllers, middleware, models, routes, services, socket, and utils. |
| NFR-010 | Testability | Backend auth, room, message, and socket workflows must have automated tests. |
| NFR-011 | Usability | The frontend must provide clear validation errors and responsive layouts. |
| NFR-012 | Observability | The backend must include structured error responses and request logging by the hardening sprint. |

## 9. External Interface Requirements

### REST API

The REST API uses JSON over HTTP, mounted at `/api`. Protected endpoints require:

```http
Authorization: Bearer <jwt>
```

### Socket.io

The Socket.io connection must include the JWT in `socket.handshake.auth.token`. Unauthorized sockets are rejected before room events are registered.

### Database

MongoDB stores durable application data. Mongoose models enforce schema-level validation, indexes, virtuals, and response sanitization.

### Cache

Redis stores online presence, recent message history, and token blacklist entries with TTLs.

### Queue

Azure Service Bus receives message delivery events for asynchronous reliability and future worker processing.

## 10. Data Requirements

- User records must include username, email, password hash, creation time, and last seen time.
- Room records must include room name, room type, members, and creation time.
- Message records must include room, sender, content, message type, timestamp, and delivery status.
- Message history queries must be indexed by room and timestamp.

## 11. Constraints

- The backend must use Node.js and Express.
- Real-time communication must use Socket.io.
- MongoDB access must use Mongoose.
- Redis access must use ioredis.
- Azure Service Bus integration must use the official SDK.
- Docker Compose must run the local supporting services.
- Git commands must not be run by the assistant; commit instructions are provided to Shriya at sprint checkpoints.

## 12. Assumptions

- Users have unique usernames and unique email addresses.
- Public rooms are visible to authenticated users; private rooms require membership.
- The initial system uses one backend instance in local development.
- Azure Service Bus credentials may be omitted in local development, but the service integration must handle that safely.
- Message content is plain text in the initial version.
- Redis is treated as a performance layer; MongoDB remains the source of truth.

## 13. Success Criteria

The final project is successful when:

- `docker compose up --build` starts the application stack.
- A user can register, log in, create or join a room, and chat in real time.
- Messages persist in MongoDB and recent history is cached in Redis.
- Auth, room, message, socket, and frontend component tests pass.
- Documentation clearly explains requirements, architecture, APIs, schemas, testing, and deployment.
