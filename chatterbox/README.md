<!-- Purpose: Portfolio-facing project overview, quickstart, and operational reference for ChatterBox. -->

# ChatterBox

**A production-oriented real-time chat application built by Shriya Patel.**

ChatterBox v4.0.0 is a WhatsApp-style full-stack messaging app with authenticated room chat, one-to-one direct messages, media attachments, voice notes, browser notifications, WebRTC 1:1 voice/video calls, statuses/stories, channels/broadcasts, session management, privacy controls, group management, disappearing messages, locked chats, block/report flows, a browser-native encryption demo, MongoDB persistence, Redis presence/cache, optional scaling hooks, Docker Compose, and CI-ready tests.

![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-010101?logo=socketdotio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

## v4.0.0 Features

- Registration, login, logout, JWT auth, bcrypt password hashing, protected routes, rate limits, validation, Helmet, and CORS allowlists
- Public/private rooms with owner/admin/member roles, group details, group settings, invite links, join approval, member add/remove, admin promote/demote, leave, and owner delete
- Room chat with real-time messages, typing indicators, Redis recent-history cache, cursor-paginated history, optional recent history for new members, and admins-only send mode
- One-to-one direct conversations with duplicate-pair prevention, WhatsApp-style conversation list, unread counts, online indicators, and preserved room tab
- Direct messages with optimistic `sending`, `sent`, `delivered`, and `failed` states plus retry for failed sends
- Read receipts, reply previews, quote scroll targeting, emoji reactions, sender-only edit, and delete-for-everyone soft delete
- Media messages for `text`, `image`, `video`, `file`, and `audio`
- Local secure uploads with allowed MIME validation, file-size limits, executable rejection, and participant-only attachment access
- Browser-native voice notes with `MediaRecorder`, recording timer, cancel/preview/send flow, and audio playback bubbles
- Browser-native notifications with user-triggered permission request and muted-chat respect
- Browser-native WebRTC 1:1 voice and video calls using Socket.io signaling, incoming call modal, mute/camera controls, duration, end call, and missed-call messages
- Status/stories with text, image, and video support, 24-hour expiry, viewers, and local cleanup
- Channels/broadcasts with owner/admin posting, followers, discovery/search, simple posts, and reactions
- Multi-device/session foundation with session records, user-agent tracking, logout current session, and logout all other sessions
- Local admin observability dashboard with total users, active users, total messages, messages per day, active conversations, open reports, and health status
- Optional Redis Socket.io adapter hook and Compose `scale` profile for local multi-instance experiments
- User profile editing with `displayName`, `about`, local avatar upload, chat-list/header/message avatar rendering, and initials fallback
- Pinned chats at the top, archived chats in a separate section, and muted chats that suppress notifications
- Conversation-scoped message search using MongoDB-backed scoped queries
- Disappearing messages for direct conversations and groups with `off`, `24h`, `7d`, and `90d` modes plus a local cleanup worker
- Block/unblock users, local report storage, and an admin-only moderation report list
- Locked chats with account-password or local-PIN unlock; PINs are hashed with bcrypt
- Privacy settings for last seen, online status, read receipts, profile photo, and about visibility
- Basic client-side encryption demo for direct chats using browser Web Crypto, localStorage demo key storage, and ciphertext-only server persistence for encrypted messages
- Local no-op event publisher by default; optional Azure Service Bus only when explicitly enabled with user-owned credentials
- Docker Compose for client, server, MongoDB, Redis, and local upload volume
- Backend, frontend, and optional Playwright E2E tests for v1, v2.0, v2.5, v3.0, and v4.0 behavior

All v4.0.0 features use free, local, open-source, or browser-native resources. No Cloudinary, Firebase, S3, Twilio, SendGrid, Pusher, paid call/media provider, paid monitoring service, paid moderation API, paid identity service, or paid storage service is required.

## Architecture

```text
Browser
  | REST + authenticated Socket.io
  v
Nginx client container (React static app)
  |
  v
Node.js server container (Express + Socket.io)
  |             |             |                 |
  v             v             v                 v
MongoDB       Redis       Local uploads     Event publisher
durable data  cache       filesystem        noop by default
```

MongoDB is the source of truth for users, rooms, conversations, messages, profile metadata, conversation settings, and attachment metadata. Redis stores expiring presence, token blacklist, and room history cache. Uploaded media is stored on the local filesystem through a storage abstraction so a future cloud adapter can be added without changing route or message contracts.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full data flow.

## Quickstart With Docker

Prerequisites: Docker Desktop with Compose.

```bash
cp .env.example .env
# Replace JWT_SECRET in .env with a long random local secret.
docker compose up --build
```

Open `http://localhost:3000`, register two accounts in separate browser sessions, search for the other user, and start a direct chat. The API health route is `http://localhost:5000/api/health`.

Docker Compose keeps MongoDB, Redis, and uploads in local volumes:

```bash
docker compose down
```

Use `docker compose down --volumes` only when local accounts, messages, Redis state, and uploaded media may be deleted.

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

For native local dependencies, set these in `server/.env`:

```dotenv
MONGO_URI=mongodb://localhost:27017/chatterbox
REDIS_HOST=localhost
EVENT_PUBLISHER=noop
UPLOAD_DIR=uploads
MAX_UPLOAD_FILE_SIZE_BYTES=10485760
```

The client runs at `http://localhost:3000` and expects the server at `http://localhost:5000`.

## Testing

```bash
cd server
npm test -- --runInBand

cd ../client
npm test -- --watchAll=false
npm run build
npm run test:e2e # optional; requires local app running and Playwright browsers installed
```

The backend enforces at least 80% global statement and line coverage. CI installs from lockfiles, runs backend tests, frontend tests, frontend build, and Docker image builds.

## REST API Summary

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
| `PATCH` | `/api/users/me` | Yes | Update display name, about text, and avatar attachment |
| `PATCH` | `/api/users/me/privacy` | Yes | Update app-level privacy settings |
| `POST` | `/api/users/:id/block` | Yes | Block a user from direct messaging you |
| `DELETE` | `/api/users/:id/block` | Yes | Unblock a user |
| `GET` | `/api/sessions` | Yes | List active browser sessions |
| `DELETE` | `/api/sessions/all` | Yes | Logout all other sessions |
| `POST` | `/api/attachments?purpose=&conversationId=` | Yes | Upload local avatar or message attachment |
| `GET` | `/api/attachments/:id/content` | Yes | Serve authorized local attachment bytes |
| `GET` | `/api/statuses` | Yes | List active 24-hour statuses |
| `POST` | `/api/statuses` | Yes | Create text/image/video status |
| `GET` | `/api/channels?search=` | Yes | Discover channels |
| `POST` | `/api/channels` | Yes | Create channel |
| `POST` | `/api/channels/:id/posts` | Yes | Create admin-only channel post |
| `GET` | `/api/admin/dashboard` | Admin | Local observability dashboard metrics |
| `POST` | `/api/conversations/direct` | Yes | Create/get one-to-one conversation |
| `GET` | `/api/conversations?search=` | Yes | List conversations with unread counts and settings |
| `GET` | `/api/conversations/:id/messages` | Yes | Cursor-paginated direct-message history |
| `GET` | `/api/conversations/:id/search?q=` | Yes | Search text messages inside one authorized conversation |
| `POST` | `/api/conversations/:id/read` | Yes | Mark direct messages as read |
| `PATCH` | `/api/conversations/:id/settings` | Yes | Update pinned, archived, muted, or locked settings |
| `PATCH` | `/api/conversations/locked-pin` | Yes | Set or rotate a local locked-chat PIN hash |
| `POST` | `/api/conversations/:id/unlock` | Yes | Unlock a locked chat with password or PIN |
| `PATCH` | `/api/conversations/:id/disappearing` | Yes | Set direct-chat disappearing message mode |
| `PATCH` | `/api/conversations/:id/encryption` | Yes | Enable or disable encrypted demo mode |
| `POST` | `/api/rooms` | Yes | Create room |
| `GET` | `/api/rooms` | Yes | List accessible rooms |
| `PATCH` | `/api/rooms/:id` | Yes | Update group info/settings when authorized |
| `POST` | `/api/rooms/:id/invite` | Yes | Generate or reset an invite token |
| `POST` | `/api/rooms/join/:token` | Yes | Join or request to join through invite token |
| `POST` | `/api/rooms/:id/join-requests/:userId` | Yes | Approve or reject a pending join request |
| `GET` | `/api/rooms/:id/messages` | Yes | Cursor-paginated room history |
| `POST` | `/api/reports` | Yes | Store a local user/message report |
| `GET` | `/api/reports` | Admin | List locally stored reports |

Full payloads are documented in [docs/API.md](docs/API.md).

## Socket.io Events

The socket handshake supplies `auth: { token: "<jwt>" }`.

| Direction | Event | Purpose |
| --- | --- | --- |
| Client -> Server | `join_room`, `leave_room`, `send_message`, `user_typing` | Preserved room chat behavior |
| Server -> Client | `message_history`, `receive_message`, `typing_indicator`, `online_users`, `user_online`, `user_offline` | Room history, room delivery, typing, and presence |
| Client -> Server | `conversation:join`, `conversation:leave` | Join or leave authorized direct conversation rooms |
| Client -> Server | `direct_message:send` | Send text or media direct message with optional reply target |
| Server -> Client | `direct_message:new`, `media_message:new` | Deliver direct text/media messages in real time |
| Client -> Server | `message:delivered`, `message:read` | Update delivery and read receipts |
| Client -> Server | `message:reaction:update` | Add, change, or remove one emoji reaction |
| Client -> Server | `message:edit`, `message:delete` | Edit or soft-delete sender-owned direct messages |
| Client -> Server | `conversation:settings:update` | Update pinned, archived, or muted settings |
| Client -> Server | `conversation:disappearing:update`, `conversation:encryption:update` | Update direct-chat disappearing or encryption demo mode |
| Client -> Server | `profile:update` | Broadcast profile metadata changes |
| Client -> Server | `group:update`, `group:member:add`, `group:member:remove`, `group:admin:update`, `group:join_request:resolved` | Manage group info, members, admins, and join requests |
| Client -> Server | `call:offer`, `call:answer`, `call:ice-candidate`, `call:ringing`, `call:accepted`, `call:rejected`, `call:ended`, `call:missed` | WebRTC 1:1 call signaling |
| Client -> Server | `user:block`, `report:create`, `chat:locked` | Privacy and moderation updates |
| Server -> Client | `message:expired` | Notify clients that a disappearing message expired |
| Server -> Client | `conversation:updated` | Refresh previews and unread counts |
| Server -> Client | `socket_error` | Normalized socket event failure |

## Media and Voice Notes

Uploads are sent as authenticated binary requests to `/api/attachments`. The server validates MIME type, original extension, maximum size, dangerous executable extensions, attachment purpose, and conversation membership before saving the file locally.

Default upload limit:

```dotenv
MAX_UPLOAD_FILE_SIZE_BYTES=10485760
```

Allowed categories include common images, audio, video, PDF, and text files. Message attachments can only be downloaded by conversation participants. Avatar images can be viewed by authenticated users.

Voice notes use the browser `MediaRecorder` API. Browsers without `MediaRecorder` show a graceful UI fallback; no external recording service is used.

## Browser Notifications

Notifications use only the browser Notification API. The UI asks for permission only after the user clicks the notification control. A notification is shown for new messages when the tab is hidden or the user is viewing another conversation. Muted conversations do not trigger notifications.

## Privacy and Security

Version 4.0.0 keeps the v3 privacy controls and adds WebRTC calling, statuses, channels, sessions, scaling hooks, and local dashboard metrics. Locked chats are web-app-level privacy, not device biometric security. The encryption demo uses browser Web Crypto and stores symmetric demo keys in `localStorage`; it is not production-grade E2EE, does not implement Signal protocol, and does not provide secure multi-device key exchange.

See [docs/PRIVACY_AND_SECURITY.md](docs/PRIVACY_AND_SECURITY.md) for the full limitations and threat-model notes.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode: `development`, `test`, or `production` |
| `CLIENT_PORT`, `SERVER_PORT` | Host ports exposed by Docker Compose |
| `CLIENT_URL`, `CORS_ALLOWED_ORIGINS` | Browser URL and accepted comma-separated origins |
| `VITE_API_BASE_URL`, `VITE_SOCKET_URL` | REST and socket URLs compiled into the client build |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT signing secret and token lifetime |
| `BCRYPT_SALT_ROUNDS` | Password hash work factor |
| `MONGO_URI`, `MONGO_TEST_URI`, `MONGO_INITDB_DATABASE` | MongoDB runtime, test, and local initialization values |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS`, `REDIS_CLUSTER_NODES` | Redis connection settings |
| `UPLOAD_DIR` | Local filesystem upload root, default `uploads` |
| `MAX_UPLOAD_FILE_SIZE_BYTES` | Maximum single upload size, default `10485760` |
| `EVENT_PUBLISHER` | `noop` by default; set `azure` only if using your own Service Bus |
| `AZURE_SERVICE_BUS_CONNECTION_STRING`, `AZURE_SERVICE_BUS_QUEUE_NAME` | Optional Azure queue values used only when Azure publishing is enabled |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | Authentication brute-force protections |
| `MESSAGE_HISTORY_LIMIT`, `MESSAGE_CACHE_TTL_SECONDS`, `ONLINE_USER_TTL_SECONDS` | Message cache and presence controls |
| `JSON_BODY_LIMIT`, `COMPRESSION_THRESHOLD_BYTES`, `TRUST_PROXY`, `SHUTDOWN_TIMEOUT_MS` | HTTP and runtime controls |

Production startup validates `JWT_SECRET`, `MONGO_URI`, and `CORS_ALLOWED_ORIGINS`. Azure variables are required only when `EVENT_PUBLISHER=azure`.

## Project Structure

```text
chatterbox/
|-- .github/workflows/ci.yml
|-- client/
|   |-- src/
|   |-- Dockerfile
|   `-- nginx.conf
|-- docs/
|-- server/
|   |-- src/
|   |-- tests/
|   |-- uploads/.gitkeep
|   `-- Dockerfile
|-- .env.example
|-- docker-compose.yml
`-- docker-compose.prod.yml
```

`server/uploads/` is ignored by git except `.gitkeep`; Docker stores it in the `server-uploads` volume.

## Known Limitations

- The default topology runs one Node.js server instance; v4 includes an optional Redis Socket.io adapter hook and Compose scale profile, but real production scaling still needs load balancing and sticky sessions.
- WebRTC calls are 1:1 peer-to-peer for localhost/LAN demos. Production NAT traversal usually needs properly operated TURN infrastructure.
- Media storage is local filesystem storage. The code is abstracted for future Azure Blob/S3-style adapters, but no cloud storage is required or configured in v4.0.0.
- Browser notifications are local browser notifications while the app is open; web push service workers are outside this release.
- Voice-note duration and media dimensions are stored when available from the client/runtime; deep media probing is intentionally avoided to keep dependencies local and light.

## Documentation

[SRS](docs/SRS.md) | [Architecture](docs/ARCHITECTURE.md) | [API](docs/API.md) | [Room API](docs/API_SPEC.md) | [Schema](docs/DB_SCHEMA.md) | [Test Plan](docs/TEST_PLAN.md) | [Deployment](docs/DEPLOYMENT.md) | [Privacy and Security](docs/PRIVACY_AND_SECURITY.md) | [WebRTC Calls](docs/WEBRTC_CALLS.md) | [Scaling](docs/SCALING.md) | [E2E Testing](docs/E2E_TESTING.md) | [Sprint Log](docs/SPRINT_LOG.md)

## License

MIT License. Built by Shriya Patel as a portfolio demonstration of full-stack and distributed-system engineering.
