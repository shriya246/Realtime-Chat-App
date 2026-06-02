<!-- Purpose: v2.5.0 system architecture, data flow, security, storage, notifications, and deployment design for ChatterBox. -->

# System Architecture

## 1. Overview

ChatterBox is a container-ready real-time chat system. The React single-page app is built by Vite and served by Nginx. REST and Socket.io traffic reaches a Node.js/Express server that owns authentication, authorization, direct conversations, rooms, messages, local media storage, browser-notification decisions, profile updates, Redis-backed presence/cache, and optional event publication.

MongoDB is durable truth. Redis stores transient state. Local filesystem storage stores uploads in development and Docker Compose. Event publishing defaults to a local no-op publisher. Azure Service Bus is optional and disabled unless `EVENT_PUBLISHER=azure` is explicitly configured.

## 2. Component Diagram

```text
                         Browser
               React UI + Notification API + MediaRecorder
                            |
                            | HTTP / WebSocket / binary upload
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
                    +---+------+-----+----------+
                        |      |                |
               Mongoose |      |                | storage service
                        |      |                |
                   +----v--+ +-v-----+   +------v-------+
                   |MongoDB| | Redis |   | Local uploads |
                   +-------+ +-------+   +--------------+
                        \
                         \ optional delivery events
                          v
                   +-------------------+
                   | Azure Service Bus |
                   | only if enabled   |
                   +-------------------+
```

## 3. Responsibilities

| Component | Responsibility |
| --- | --- |
| React client | Auth UI, WhatsApp-style conversation list, direct chat, room chat, media previews, voice recording, notifications, profile modal, search, and mobile navigation. |
| Browser APIs | `Notification` for local browser notifications and `MediaRecorder` for voice-note capture. |
| Express API | Auth, users, attachments, conversations, settings, search, rooms, history, read receipts, health, and normalized errors. |
| Socket.io engine | Authenticated live rooms, direct-message delivery, media-message events, receipts, reactions, edits, deletes, settings updates, profile updates, presence, and typing. |
| MongoDB/Mongoose | Users, rooms, conversations, messages, attachment metadata, indexes, and schema validation. |
| Redis/ioredis | Room recent-message cache, online users, and revoked JWT blacklist keys. |
| Storage service | Validates and writes local uploads under `UPLOAD_DIR`; exposes an abstraction for future cloud adapters. |
| Event publisher | Local no-op publisher by default; optional Azure publisher only with user-provided credentials. |

## 4. Technology Decisions

| Technology | Decision rationale |
| --- | --- |
| React and Vite | Fast local workflow, component-level testability, and optimized production builds. |
| TailwindCSS | Compact operational chat UI with consistent responsive styling. |
| Express | Mature middleware model for validation, binary upload routing, security headers, and REST resources. |
| Socket.io | Authenticated rooms, acknowledgements, reconnection support, and browser compatibility. |
| MongoDB and Mongoose | Natural document relationships for chat, receipts, settings, and attachment metadata. |
| Redis | Low-latency expiring state for presence, recent room history, and revoked access tokens. |
| Local filesystem storage | Free local media storage in development and Compose, abstracted for later replacement. |
| Browser APIs | Notifications and voice capture without paid push, recording, or media services. |

## 5. Authentication and Authorization

1. Registration validates username, email, and password.
2. Mongoose hashes the password with bcrypt.
3. Login signs a JWT from `JWT_SECRET`.
4. Axios sends the bearer token for REST.
5. Socket.io receives the token through handshake `auth`.
6. Middleware rejects missing, invalid, expired, revoked, or deleted-user tokens.
7. Logout stores a Redis blacklist key until token expiry.

Authorization is enforced server-side:

- Private room access requires membership.
- Direct conversation access requires one of the two participants.
- Direct message send/read/search/history requires conversation membership.
- Message edit/delete requires the sender.
- Message reactions require membership and one reaction per user.
- Attachment upload/download for messages requires conversation membership.
- Avatar upload requires the owner to be authenticated.
- Conversation settings are scoped per signed-in user.

## 6. Direct and Media Message Flow

```text
Client uploads file
  -> POST /api/attachments with auth, Content-Type, X-File-Name
  -> validate MIME, extension, size, purpose, and conversation membership
  -> save bytes under UPLOAD_DIR
  -> persist Attachment metadata in MongoDB
  -> return attachment id and content URL

Client direct_message:send
  -> validate authenticated socket and conversation membership
  -> if attachmentId is supplied, verify attachment ownership/access
  -> persist Message with type text/image/video/file/audio
  -> update Conversation last-message preview
  -> emit direct_message:new to participant user rooms
  -> emit media_message:new for media messages
  -> emit conversation:updated with participant-specific unread counts
  -> publish through noop or optional Azure publisher
```

Message types:

- `text`
- `image`
- `video`
- `file`
- `audio`

Attachment metadata includes original filename, stored filename/path, MIME type, size, optional duration, optional width, and optional height. Deep media probing is intentionally avoided to keep the app local and dependency-light.

## 7. Voice Notes

Voice notes are audio attachments created by the browser:

```text
User starts recording
  -> browser getUserMedia microphone permission
  -> MediaRecorder captures chunks
  -> timer updates in composer
  -> user stops recording
  -> audio/webm File preview appears
  -> upload as purpose=message
  -> send direct message with audio attachment
```

If `MediaRecorder` or microphone access is unavailable, the UI shows a fallback error and does not call any external recording service.

## 8. Browser Notifications

Notifications are purely browser-native:

- Permission is requested only when the user clicks the notification control.
- Notifications are shown for new direct messages when the tab is hidden or the user is not viewing that conversation.
- Muted conversations suppress notifications.
- Notifications are not web-push notifications and do not require Firebase, Push API servers, Twilio, SendGrid, or paid providers.

## 9. Conversation Settings

Conversation settings are stored per user inside the `Conversation.settings` array:

- `pinned`: conversation appears above non-pinned conversations.
- `archived`: conversation moves to the archived section.
- `muted`: browser notifications are suppressed.

Settings can be updated through REST or Socket.io and are returned in conversation summaries.

## 10. Search

Message search is scoped to one authorized direct conversation:

```text
GET /api/conversations/:id/search?q=needle&limit=20
  -> verify membership
  -> escape user query
  -> search non-deleted text messages
  -> return formatted direct-message results
```

The implementation uses MongoDB queries with safe limits. No paid search service is used.

## 11. Redis Strategy

| Redis key | Value | Expiration | Use |
| --- | --- | --- | --- |
| `messages:<roomId>` | Newest-first JSON message list | `MESSAGE_CACHE_TTL_SECONDS`, default 86400 seconds | Fast latest-history response on room join |
| `online:<userId>` | Presence JSON payload | `ONLINE_USER_TTL_SECONDS`, default 3600 seconds | Current online list and stale presence cleanup |
| `blacklist:<token>` | Revocation marker | Remaining JWT lifetime | Immediate logout invalidation |

Direct-message history, search, receipts, media metadata, and conversation settings are served from MongoDB, not Redis cache.

## 12. Frontend Modules

```text
App
|-- AuthProvider
|-- SocketProvider
`-- ChatPage
    |-- Sidebar
    |   |-- conversations, rooms, search, pin/mute/archive, notifications
    |-- DirectChatWindow
    |   |-- history, media composer, voice recorder, search, receipts
    |-- ChatWindow
    |   |-- preserved room chat
    `-- ProfileModal
        |-- display name, about, avatar upload
```

| Module | Role |
| --- | --- |
| `AuthContext` | Restores sessions and updates the stored signed-in profile. |
| `SocketContext` | Owns authenticated real-time connection and reconnection state. |
| `useMessages` | Preserved room lifecycle, history/events, typing, optimistic sends, and queued replay. |
| `useDirectMessages` | Direct-message history, live events, media upload helper, read receipts, reactions, edit/delete, search, and retry. |
| `Sidebar` | Conversation list, archived section, rooms tab, people search, notification button, and profile entry point. |
| `DirectChatWindow` | Media previews, voice recording, message search, reply composer, reaction/edit/delete controls, and mobile-safe composer. |
| `MessageBubble` | Text, image, video, audio, file rendering, reply quote, reactions, timestamps, and receipt glyphs. |

## 13. Deployment Architecture

```text
Docker Compose
|-- client: Nginx serving Vite bundle on host port 3000
|-- server: non-root Node.js runtime on host port 5000
|       |-- waits for healthy MongoDB and Redis
|       |-- mounts server-uploads volume at /app/uploads
|       `-- uses EVENT_PUBLISHER=noop unless optional Azure is enabled
|-- mongo: MongoDB 7 with persistent volume
`-- redis: Redis 7 with append-only persistent volume
```

The production Compose override can bind external MongoDB/Redis if desired. The default local stack uses free local containers and local upload storage.

## 14. Security and Privacy Notes

| Area | Design |
| --- | --- |
| Credentials | Passwords hashed with bcrypt; JWT secret supplied by environment. |
| Upload validation | MIME allowlist, size limit, executable extension rejection, and purpose-specific checks. |
| Attachment access | Message files are available only to conversation participants. |
| Local media privacy | Uploaded files remain on the local server filesystem or Docker volume. |
| Browser microphone | Voice notes use browser microphone permission and never call a third-party recording API. |
| Browser notifications | Permission is user-triggered and local to the browser. |
| External services | None required; Azure Service Bus is optional and off by default. |

## 15. Scaling Path

The portfolio delivery runs one Node.js server instance. Horizontal production scaling would add the Socket.io Redis adapter, API replicas behind a load balancer, shared object storage behind the existing storage abstraction, managed MongoDB/Redis resiliency, optional event consumers, and observability for sockets, uploads, and queue outcomes.
