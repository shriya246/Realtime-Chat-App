<!-- Purpose: v3.0.0 deployment, environment, local storage, privacy, health-check, and troubleshooting guide for ChatterBox. -->

# Deployment and Setup Guide

## 1. Deployment Model

ChatterBox ships with a production-shaped local topology:

```text
Browser -> Nginx/React client -> Express + Socket.io server
                                      |       |       |
                                   MongoDB  Redis  Local uploads
                                      |
                              Local no-op event publisher
```

The base Compose file starts the client, server, MongoDB, Redis, and a named local upload volume. Event publishing defaults to `EVENT_PUBLISHER=noop`, so no paid third-party service is required. Azure Service Bus remains optional only when a deployer explicitly sets `EVENT_PUBLISHER=azure` and supplies their own credentials.

## 2. Prerequisites

| Workflow | Requirements |
| --- | --- |
| Docker quickstart | Docker Desktop and Docker Compose |
| Native development | Node.js `^20.19.0` or `>=22.12.0`, npm `>=10`, MongoDB, Redis |
| Production deployment | Secure secret storage, accessible MongoDB and Redis, TLS/reverse proxy; optional cloud object storage only if a future adapter is added |

No Cloudinary, Firebase Storage, S3 bucket, Twilio, SendGrid, Pusher, paid push provider, paid moderation API, paid identity provider, paid scheduler, or paid recording service is needed.

v4.0.0 also avoids paid call/media and monitoring services. WebRTC calls use browser APIs and Socket.io signaling. The admin dashboard uses local MongoDB/Redis data. Optional E2E tests use open-source Playwright.

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

Persistent volumes keep MongoDB, Redis, and uploaded media after `docker compose down`.

```bash
docker compose down
```

Use this only when local data can be discarded:

```bash
docker compose down --volumes
```

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
EVENT_PUBLISHER=noop
UPLOAD_DIR=uploads
MAX_UPLOAD_FILE_SIZE_BYTES=10485760
```

## 5. Local File Storage

v3.0.0 stores uploads on the local filesystem:

| Setting | Default | Purpose |
| --- | --- | --- |
| `UPLOAD_DIR` | `uploads` | Root directory under the server working directory. |
| `MAX_UPLOAD_FILE_SIZE_BYTES` | `10485760` | Maximum single upload size, 10 MiB by default. |

Source control keeps `server/uploads/.gitkeep` but ignores uploaded files:

```text
server/uploads/*
!server/uploads/.gitkeep
```

Docker Compose mounts the server upload directory through a named volume:

```text
server-uploads:/app/uploads
```

The storage code is behind `storageService`, so future Azure Blob or S3 adapters can be added later. v3.0.0 does not require or configure cloud storage.

## 6. Runtime Environment Reference

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
| `JSON_BODY_LIMIT` | `1mb` | Maximum parsed JSON request payload. |
| `COMPRESSION_THRESHOLD_BYTES` | `1024` | Minimum response size for gzip compression. |
| `TRUST_PROXY` | `false` | Set `true` behind a controlled reverse proxy. |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful resource shutdown deadline. |

### Data, Media, and Integration Services

| Variable | Local value | Production guidance |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://mongo:27017/chatterbox` | Required MongoDB URI. |
| `MONGO_TEST_URI` | Local test URI | Only used by tests. |
| `MONGO_INITDB_DATABASE` | `chatterbox` | Local Mongo container initialization. |
| `MONGO_MAX_POOL_SIZE` | `10` | Tune per API replica and provider limit. |
| `MONGO_PORT` | `27017` | Local published port only. |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` | Redis endpoint. |
| `REDIS_PUBLIC_PORT` | `6379` | Local published port only. |
| `REDIS_PASSWORD` | Empty | Supply through secret storage when required. |
| `REDIS_DB` / `REDIS_TLS` | `0` / `false` | Enable TLS when using managed providers. |
| `REDIS_CLUSTER_NODES` | Empty | Optional `host-a:6379,host-b:6379` for cluster mode. |
| `UPLOAD_DIR` | `uploads` | Local filesystem upload root. |
| `MAX_UPLOAD_FILE_SIZE_BYTES` | `10485760` | Maximum upload size in bytes. |
| `MESSAGE_HISTORY_LIMIT` | `50` | Cached/join-history message count. |
| `MESSAGE_CACHE_TTL_SECONDS` | `86400` | Recent-history cache duration. |
| `ONLINE_USER_TTL_SECONDS` | `3600` | Presence expiry guard. |
| `EVENT_PUBLISHER` | `noop` | Keep `noop` for free local/Compose deployments; set `azure` only for optional Service Bus. |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | Empty | Required only when `EVENT_PUBLISHER=azure`. |
| `AZURE_SERVICE_BUS_QUEUE_NAME` | `chatterbox-messages` | Optional queue receiving delivery events. |

## 7. Browser Feature Notes

| Feature | Requirement | Behavior |
| --- | --- | --- |
| Notifications | Browser Notification API | Permission is requested from the UI only; muted chats suppress notifications. |
| Voice notes | Browser `MediaRecorder` and microphone permission | Records audio locally in the browser and uploads it as an audio attachment. |
| WebRTC calls | Browser `getUserMedia`, `RTCPeerConnection`, Socket.io | 1:1 peer-to-peer calls for localhost/LAN demos. |
| Media preview | Browser file/object URL support | Shows selected image/audio/video/file previews before send. |
| Encryption demo | Browser Web Crypto and localStorage | Encrypts direct-message text in the browser for demo conversations; stores demo keys locally. |
| Locked chats | Account password or local PIN | PIN hash is stored with bcrypt; unlock state is short-lived and per user. |
| Disappearing messages | Server process interval | Local cleanup worker soft-deletes expired messages and emits `message:expired`. |
| Reports | MongoDB | Reports are stored locally and visible only to admin users. |
| Status cleanup | Server process interval | Expired 24-hour statuses are deleted locally. |

No server-side push provider or media transcription/processing API is required.

Optional scaling experiment:

```bash
SOCKET_IO_REDIS_ADAPTER=true docker compose --profile scale up --build
```

The default local stack remains one API instance. Real production scaling still needs a reverse proxy/load balancer and sticky sessions.

## 8. Production Compose Deployment

The production override sets `NODE_ENV=production`, trusts the deployment proxy, requires core service credentials, keeps the no-op event publisher by default, and applies resource limits.

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
MONGO_URI=<mongodb-uri>
EVENT_PUBLISHER=noop
UPLOAD_DIR=uploads
MAX_UPLOAD_FILE_SIZE_BYTES=10485760
```

For an external Redis service, also replace `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and `REDIS_TLS`; clustered providers may use `REDIS_CLUSTER_NODES`.

## 9. Optional Azure Service Bus Setup

Skip this section for the default free/local deployment.

1. Set `EVENT_PUBLISHER=azure`.
2. Create a Service Bus namespace and queue using resources you own.
3. Set `AZURE_SERVICE_BUS_QUEUE_NAME`.
4. Store the connection string as `AZURE_SERVICE_BUS_CONNECTION_STRING`.
5. Restart the server and send a message.

The live chat message is persisted before publication. A queue publish failure is logged without deleting or hiding an already delivered message.

## 10. Health and Operational Checks

| Component | Check | Healthy result |
| --- | --- | --- |
| Server | `GET /api/health` | HTTP `200`, `status: "ok"`, MongoDB and Redis `ready` |
| Client | `GET /health` inside/client container | HTTP `200` from Nginx |
| MongoDB | Compose `mongosh` health check | Ping succeeds |
| Redis | Compose `redis-cli ping` health check | `PONG` |
| Upload volume | Send an image/file message | Attachment metadata saved and file served to participants |
| Disappearing worker | Send a message with short expiry in test/local config | Expired messages are filtered and soft-deleted by the server interval |
| Locked chat | Lock and unlock a direct chat | History is blocked until password/PIN unlock succeeds |
| Reports | Create a local report as a user, list as an admin | Report is stored in MongoDB; no external moderation call occurs |
| Event publisher | Send a chat message with default config | Message accepted; publisher reports local no-op |

The server returns HTTP `503` with `status: "degraded"` when required local MongoDB or Redis readiness is unavailable.

## 11. CI Pipeline

`.github/workflows/ci.yml` runs on changes targeting `main`. It installs from lockfiles, runs backend tests with coverage threshold, runs frontend tests, produces the Vite bundle, and builds both production Docker images.

## 12. Troubleshooting

| Symptom | Cause to check | Resolution |
| --- | --- | --- |
| Server exits at startup in production | Required variables are missing | Supply JWT, MongoDB, and CORS values. Supply Azure only if `EVENT_PUBLISHER=azure`. |
| Health endpoint returns `503` | MongoDB or Redis unavailable | Inspect connection URI/host, TLS, credentials, and container health. |
| Upload rejected | MIME type, extension, or file size not allowed | Use supported media/file types and stay below `MAX_UPLOAD_FILE_SIZE_BYTES`. |
| Attachment returns `403` | Signed-in user is not a conversation participant | Open/download only attachments from conversations the user belongs to. |
| Browser notification never appears | Permission denied, tab focused, wrong conversation active, or chat muted | Re-enable browser permission and unmute the conversation. |
| Voice recording unavailable | Browser lacks `MediaRecorder` or microphone permission is denied | Use a supported browser and allow microphone access. |
| Locked chat will not open | Wrong account password/PIN or unlock expired | Re-enter the account password or reset the local PIN while signed in. |
| Encrypted demo message cannot decrypt | The browser lacks the localStorage demo key | Re-share/regenerate the demo key manually for testing; this release does not implement secure key exchange. |
| Expired messages still visible briefly | Cleanup interval has not run yet or client has cached view | Refresh history; APIs filter expired messages even before cleanup soft-delete. |
| Browser reports CORS failure | Origin not in allowlist | Add the exact UI origin to `CORS_ALLOWED_ORIGINS` and restart. |
| Socket authentication fails | Missing, expired, or revoked JWT | Sign in again and inspect handshake `auth.token`. |
| Client calls old API domain | Vite values changed after build | Rebuild the client image with updated `VITE_*` values. |

## 13. Release Checklist

- Rotate all template secrets and use secret-manager injection.
- Set HTTPS browser origins and public API/socket build URLs.
- Confirm MongoDB backups and Redis access controls if deploying beyond local Compose.
- Keep `EVENT_PUBLISHER=noop` unless the deployment intentionally uses optional Azure Service Bus.
- Confirm `UPLOAD_DIR` persistence and backup policy for local media.
- Run server tests, client tests, and the client production build.
- Build images and validate health probes in the target environment.
- Verify register/login, direct chat, group management, invite/join approval, disappearing messages, block/report, locked chat, encrypted demo, media send, voice note, notifications, profile avatar, privacy settings, pin/archive/mute, search, and preserved room chat.
