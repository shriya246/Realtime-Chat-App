<!-- Purpose: v3.0.0 system architecture, data flow, privacy, security, storage, notifications, and deployment design for ChatterBox. -->

# System Architecture

## 1. Overview

ChatterBox is a container-ready real-time chat system. The React single-page app is built by Vite and served by Nginx. REST and Socket.io traffic reaches a Node.js/Express server that owns authentication, authorization, direct conversations, group management, messages, disappearing-message cleanup, local media storage, privacy settings, moderation reports, browser-notification decisions, profile updates, Redis-backed presence/cache, and optional event publication.

MongoDB is durable truth. Redis stores transient state. Local filesystem storage stores uploads in development and Docker Compose. Event publishing defaults to a local no-op publisher. Azure Service Bus is optional and disabled unless `EVENT_PUBLISHER=azure` is explicitly configured.

## 2. Component Diagram

```text
                         Browser
     React UI + Notification API + MediaRecorder + Web Crypto
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
| React client | Auth UI, WhatsApp-style conversation list, direct chat, group details, room chat, locked-chat unlock, encryption demo, media previews, voice recording, notifications, profile/privacy modals, search, and mobile navigation. |
| Browser APIs | `Notification` for local browser notifications, `MediaRecorder` for voice-note capture, and Web Crypto for the encryption demo. |
| Express API | Auth, users, privacy, block/unblock, attachments, conversations, locked chat, disappearing settings, encryption flags, reports, settings, search, groups, history, read receipts, health, and normalized errors. |
| Socket.io engine | Authenticated live rooms, group admin events, direct-message delivery, media-message events, receipts, reactions, edits, deletes, settings updates, profile updates, report/block events, presence, and typing. |
| MongoDB/Mongoose | Users, rooms/groups, conversations, messages, reports, attachment metadata, indexes, and schema validation. |
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
| Web Crypto demo | Demonstrates client-side ciphertext storage with browser-native AES-GCM; documented as non-production E2EE. |

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
- Group member management requires owner/admin authority.
- Group owner-only actions include group deletion and owner-level admin control.
- Admins-only group send mode is enforced before room messages are persisted.
- Locked direct chats require account-password or local-PIN unlock before history is returned.
- Blocked users cannot send direct messages to the blocker.
- Reports are stored locally and listed only for users marked `isAdmin`.

## 6. Group Management Flow

```text
Admin opens group details
  -> PATCH /api/rooms/:id or group:update socket event
  -> verify membership and owner/admin role
  -> apply allowed name/description/settings/member/admin update
  -> return normalized room with member roles
  -> emit group:update or member/admin event to room participants
```

Invite links are generated with local random tokens stored on the room. If `joinApprovalRequired` is off, a valid invite adds the user as a member. If approval is on, the join creates a pending request; admins approve or reject it through REST or socket events. New-member history is controlled by `newMembersCanSeeRecentHistory` and is documented as a simple last-50-message setting.

## 7. Direct and Media Message Flow

```text
Client uploads file
  -> POST /api/attachments with auth, Content-Type, X-File-Name
  -> validate MIME, extension, size, purpose, and conversation membership
  -> save bytes under UPLOAD_DIR
  -> persist Attachment metadata in MongoDB
  -> return attachment id and content URL

Client direct_message:send
  -> validate authenticated socket and conversation membership
  -> reject if the sender is blocked by the recipient
  -> if attachmentId is supplied, verify attachment ownership/access
  -> persist Message with type text/image/video/file/audio and optional expiresAt/encryption metadata
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

## 8. Disappearing Messages

Direct conversations and groups store a disappearing mode of `off`, `24h`, `7d`, or `90d`. When a new message is persisted, the server calculates `expiresAt` from the owning conversation/group setting. History and search endpoints filter expired messages. A local Node interval scans expired messages, soft-deletes them with an expiry placeholder, and emits `message:expired`.

No paid scheduler, queue, or external worker is required. The cleanup interval runs inside the server process and is stopped during graceful shutdown.

## 9. Locked Chats

Locked chats are per-user conversation settings. A locked conversation is hidden behind an unlock form in the UI and protected on the history endpoint. Unlock accepts either the account password or a local PIN. PINs are bcrypt-hashed on the user record and never returned to clients. Successful unlock sets `unlockedUntil` for a short session window.

This is web-app-level privacy. It is not biometric security and does not protect against a fully compromised browser session.

## 10. Encryption Demo

The encrypted direct-chat mode is a portfolio/demo implementation:

```text
User enables encrypted demo
  -> browser generates/stores a symmetric demo key in localStorage
  -> message body is encrypted in the client with Web Crypto AES-GCM
  -> direct_message:send carries ciphertext plus IV/metadata
  -> server stores ciphertext only
  -> recipient client decrypts only if the demo key exists locally
```

The demo does not implement Signal protocol, production-grade key exchange, device verification, forward secrecy, secure multi-device sync, or protected key storage. See [PRIVACY_AND_SECURITY.md](PRIVACY_AND_SECURITY.md).

## 11. Voice Notes

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

## 12. Browser Notifications

Notifications are purely browser-native:

- Permission is requested only when the user clicks the notification control.
- Notifications are shown for new direct messages when the tab is hidden or the user is not viewing that conversation.
- Muted conversations suppress notifications.
- Notifications are not web-push notifications and do not require Firebase, Push API servers, Twilio, SendGrid, or paid providers.

## 13. Conversation Settings

Conversation settings are stored per user inside the `Conversation.settings` array:

- `pinned`: conversation appears above non-pinned conversations.
- `archived`: conversation moves to the archived section.
- `muted`: browser notifications are suppressed.
- `locked`: chat requires password/PIN unlock before opening.
- `unlockedUntil`: short-lived unlock expiry.

Settings can be updated through REST or Socket.io and are returned in conversation summaries.

## 14. Privacy, Blocking, and Reports

Privacy settings live on the user document and gate app behavior for read receipts plus visibility preferences documented for UI use. Blocking is stored as `blockedUsers`; direct message send checks the recipient's block list. Reports are local MongoDB documents and are intentionally not sent to external moderation services.

## 15. Search

Message search is scoped to one authorized direct conversation:

```text
GET /api/conversations/:id/search?q=needle&limit=20
  -> verify membership
  -> escape user query
  -> search non-deleted text messages
  -> return formatted direct-message results
```

The implementation uses MongoDB queries with safe limits. No paid search service is used.

## 16. Redis Strategy

| Redis key | Value | Expiration | Use |
| --- | --- | --- | --- |
| `messages:<roomId>` | Newest-first JSON message list | `MESSAGE_CACHE_TTL_SECONDS`, default 86400 seconds | Fast latest-history response on room join |
| `online:<userId>` | Presence JSON payload | `ONLINE_USER_TTL_SECONDS`, default 3600 seconds | Current online list and stale presence cleanup |
| `blacklist:<token>` | Revocation marker | Remaining JWT lifetime | Immediate logout invalidation |

Direct-message history, search, receipts, media metadata, and conversation settings are served from MongoDB, not Redis cache.

## 17. Frontend Modules

```text
App
|-- AuthProvider
|-- SocketProvider
`-- ChatPage
    |-- Sidebar
    |   |-- conversations, rooms, search, pin/mute/archive, notifications
    |-- DirectChatWindow
    |   |-- history, locked unlock, encryption demo, disappearing controls, media composer, voice recorder, search, receipts
    |-- ChatWindow
    |   |-- preserved room chat
    |-- GroupDetailsModal
    |   |-- group settings, member roles, admin controls
    |-- PrivacySettingsModal
    |   |-- last seen, online, receipts, profile/about visibility
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
| `DirectChatWindow` | Locked-chat unlock, disappearing mode, encrypted demo, media previews, voice recording, message search, reply composer, reaction/edit/delete controls, block/report actions, and mobile-safe composer. |
| `MessageBubble` | Text, image, video, audio, file rendering, reply quote, reactions, timestamps, and receipt glyphs. |
| `GroupDetailsModal` | Group info, disappearing mode, send/edit permissions, join approval, and member-role display. |
| `PrivacySettingsModal` | User privacy controls and read-receipt preference. |

## 18. Deployment Architecture

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

## 19. Security and Privacy Notes

| Area | Design |
| --- | --- |
| Credentials | Passwords hashed with bcrypt; JWT secret supplied by environment. |
| Upload validation | MIME allowlist, size limit, executable extension rejection, and purpose-specific checks. |
| Attachment access | Message files are available only to conversation participants. |
| Local media privacy | Uploaded files remain on the local server filesystem or Docker volume. |
| Browser microphone | Voice notes use browser microphone permission and never call a third-party recording API. |
| Browser notifications | Permission is user-triggered and local to the browser. |
| Group authorization | Owner/admin/member checks are enforced server-side for group actions. |
| Disappearing messages | Expiry is enforced by query filters plus a local cleanup worker. |
| Locked chats | PIN hashes use bcrypt; unlock state is short-lived and per user. |
| Blocking/reporting | Direct-message blocking and local moderation reports require no external provider. |
| Encryption demo | Browser-native only, stores demo keys in localStorage, and is not production-grade E2EE. |
| External services | None required; Azure Service Bus is optional and off by default. |

## 20. Scaling Path

The portfolio delivery runs one Node.js server instance. Horizontal production scaling would add the Socket.io Redis adapter, API replicas behind a load balancer, shared object storage behind the existing storage abstraction, managed MongoDB/Redis resiliency, optional event consumers, and observability for sockets, uploads, and queue outcomes.
