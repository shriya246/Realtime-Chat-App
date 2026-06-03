<!-- Purpose: MongoDB, Mongoose, Redis, and local upload schema reference for ChatterBox v3.0.0. -->

# Database Schema

## 1. Overview

ChatterBox stores durable data in MongoDB with Mongoose schemas. Redis stores transient cache, presence, and token blacklist values. Local upload files are stored on disk under `UPLOAD_DIR`, while MongoDB stores their metadata in `attachments`.

Version 3.0.0 preserves v1 room chat, v2 direct messaging, and v2.5 media/profile features while adding group roles, invite/join approval state, disappearing messages, block/report records, locked-chat settings, privacy settings, and a basic client-side encryption demo.

Version 4.0.0 adds:

- `statuses` for 24-hour text/image/video stories with viewers and privacy.
- `channels` for owner/admin broadcast channels, followers, posts, and reactions.
- `sessions` for JWT-backed browser/device session tracking and logout-all flows.
- WebRTC call signaling remains transient Socket.io state; missed calls are stored as system messages.
- Dashboard metrics are derived from existing MongoDB collections and Redis health state.

## 2. Common Conventions

- Primary identifiers use MongoDB ObjectId values.
- API responses expose `id` as a string derived from `_id`.
- Timestamps use UTC dates.
- Sensitive fields such as `passwordHash` and filesystem absolute paths are never returned to clients.
- Mongoose schema validation is paired with request-level validation.
- Attachments expose a protected URL in the form `/api/attachments/:id/content`.

## 3. User Collection

Collection name: `users`

| Field | Type | Required | Unique | Description |
| --- | --- | --- | --- | --- |
| `_id` | ObjectId | Yes | Yes | MongoDB primary key. |
| `username` | String | Yes | Yes | Searchable handle and fallback display value. |
| `email` | String | Yes | Yes | Lowercased login identifier. |
| `passwordHash` | String | Yes | No | bcrypt hash of the user password. |
| `displayName` | String | No | No | Editable display name shown in chat UI. |
| `about` | String | No | No | Short profile status/about text. |
| `avatarAttachmentId` | ObjectId | No | No | References an avatar attachment. |
| `lastSeen` | Date | No | No | Last known disconnect or activity timestamp. |
| `isAdmin` | Boolean | Yes | No | Enables access to the local moderation report list. |
| `privacySettings` | Object | Yes | No | Last seen, online, read receipt, profile photo, and about visibility controls. |
| `blockedUsers` | ObjectId[] | No | No | Users blocked by this account. |
| `lockedChatPinHash` | String | No | No | bcrypt hash for local locked-chat PIN unlock. |
| `createdAt`, `updatedAt` | Date | Yes | No | Mongoose timestamps. |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ email: 1 }` unique | Fast login lookup and duplicate prevention. |
| `{ username: 1 }` unique | Fast profile lookup and duplicate prevention. |
| `{ username: "text", email: "text" }` | User search. |
| `{ blockedUsers: 1 }` | Block checks and user search filtering. |

Privacy settings:

| Field | Type | Values |
| --- | --- | --- |
| `lastSeenVisibility` | String | `everyone`, `contacts`, `nobody` |
| `onlineVisibility` | String | `everyone`, `contacts`, `nobody` |
| `readReceipts` | Boolean | `true` or `false` |
| `profilePhotoVisibility` | String | `everyone`, `contacts`, `nobody` |
| `aboutVisibility` | String | `everyone`, `contacts`, `nobody` |

API shape:

```json
{
  "id": "6652f2d0610b1b63e7d71101",
  "username": "shriya",
  "email": "shriya@example.com",
  "displayName": "Shriya Patel",
  "about": "Building local-first chat.",
  "avatarUrl": "/api/attachments/6652f2d0610b1b63e7d71199/content",
  "lastSeen": null
}
```

## 4. Attachment Collection

Collection name: `attachments`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | MongoDB primary key. |
| `ownerId` | ObjectId | Yes | User who uploaded the file. |
| `conversationId` | ObjectId | Conditional | Direct conversation that owns a message attachment. |
| `purpose` | String enum | Yes | `message` or `avatar`. |
| `kind` | String enum | Yes | `image`, `video`, `audio`, `file`, or `avatar`. |
| `originalFilename` | String | Yes | Browser-provided filename after sanitization. |
| `storedFilename` | String | Yes | Collision-resistant local stored filename. |
| `relativePath` | String | Yes | Path relative to `UPLOAD_DIR`. |
| `mimeType` | String | Yes | Validated MIME type. |
| `size` | Number | Yes | File size in bytes. |
| `duration` | Number | No | Audio/video duration in seconds when available. |
| `width` | Number | No | Image width when available. |
| `height` | Number | No | Image height when available. |
| `createdAt`, `updatedAt` | Date | Yes | Mongoose timestamps. |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ ownerId: 1, createdAt: -1 }` | User upload history and avatar lookup. |
| `{ conversationId: 1, createdAt: -1 }` | Conversation attachment authorization and cleanup. |
| `{ purpose: 1 }` | Purpose-based queries. |

Rules:

- `purpose=message` requires `conversationId`.
- `purpose=avatar` must be an image.
- Absolute paths are not exposed in API responses.
- Bytes are stored locally in `server/uploads/` for native development or `/app/uploads` in Docker.

API shape:

```json
{
  "id": "6652f2d0610b1b63e7d71199",
  "ownerId": "6652f2d0610b1b63e7d71101",
  "conversationId": "6652f40e610b1b63e7d71110",
  "purpose": "message",
  "kind": "audio",
  "originalFilename": "voice-note.webm",
  "storedFilename": "1717180800000-voice-note.webm",
  "mimeType": "audio/webm",
  "size": 12044,
  "duration": null,
  "url": "/api/attachments/6652f2d0610b1b63e7d71199/content"
}
```

## 5. Conversation Collection

Collection name: `conversations`

Direct conversations always contain exactly two unique users. `participantKey` is the sorted pair of user IDs and is unique, which prevents duplicate one-to-one chats.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | MongoDB primary key. |
| `participants` | ObjectId[] | Yes | Exactly two users in the direct chat. |
| `participantKey` | String | Yes | Sorted unique key for duplicate prevention. |
| `lastMessageId` | ObjectId | No | Latest message used by the chat list. |
| `lastMessagePreview` | String | No | Denormalized preview for fast list display. |
| `lastMessageAt` | Date | No | Timestamp used for conversation ordering. |
| `settings` | Array | No | Per-user pinned, archived, and muted state. |
| `disappearingMode` | String enum | Yes | `off`, `24h`, `7d`, or `90d`. |
| `encryptedModeEnabled` | Boolean | Yes | Enables the client-side encryption demo UI/state. |
| `createdBy` | ObjectId | Yes | User who first opened the direct conversation. |
| `createdAt`, `updatedAt` | Date | Yes | Mongoose timestamps. |

Settings subdocument:

| Field | Type | Description |
| --- | --- | --- |
| `userId` | ObjectId | User who owns these settings. |
| `pinned` | Boolean | Pins the chat above non-pinned chats for that user. |
| `archived` | Boolean | Moves the chat to archived section for that user. |
| `muted` | Boolean | Suppresses browser notifications for that user. |
| `locked` | Boolean | Hides/requires unlock for this user's chat view. |
| `unlockedUntil` | Date | Short-lived unlock expiry after password/PIN validation. |
| `updatedAt` | Date | Last settings update. |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ participantKey: 1 }` unique | Prevent duplicate direct conversations. |
| `{ participants: 1, updatedAt: -1 }` | List conversations for a user. |
| `{ lastMessageAt: -1 }` | Sort active chats by latest activity. |

## 6. Room Collection

Collection name: `rooms`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | MongoDB primary key. |
| `name` | String | Yes | Human-readable room name. |
| `type` | String enum | Yes | `public` or `private`. |
| `members` | ObjectId[] | Yes | References to users allowed in the room. |
| `createdBy` | ObjectId | Yes | User who created the room. |
| `description` | String | No | Group description shown in details. |
| `avatarAttachmentId` | ObjectId | No | Optional group avatar attachment. |
| `ownerId` | ObjectId | Yes | Group owner with delete/admin authority. |
| `admins` | ObjectId[] | Yes | Group admins with member/settings authority. |
| `settings` | Object | Yes | Group send/edit/history/join/disappearing controls. |
| `inviteToken` | String | No | Private invite token when generated. |
| `inviteRevokedAt` | Date | No | Timestamp for revoked/reset invite links. |
| `joinRequests` | Array | No | Pending/approved/rejected join approval records. |
| `createdAt`, `updatedAt` | Date | Yes | Mongoose timestamps. |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ name: 1, type: 1 }` | Room search and filtering. |
| `{ members: 1 }` | Fast lookup for rooms visible to a user. |
| `{ createdBy: 1 }` | Creator-based room queries. |
| `{ inviteToken: 1 }` | Invite-link lookup. |

Group settings:

| Field | Type | Values |
| --- | --- | --- |
| `whoCanSendMessages` | String | `everyone` or `admins` |
| `whoCanEditInfo` | String | `everyone` or `admins` |
| `newMembersCanSeeRecentHistory` | Boolean | Enables last-50-history visibility after joining. |
| `joinApprovalRequired` | Boolean | Converts invite joins into admin-approved requests. |
| `disappearingMode` | String | `off`, `24h`, `7d`, or `90d` |

Join request subdocument:

| Field | Type | Description |
| --- | --- | --- |
| `userId` | ObjectId | User requesting access. |
| `status` | String | `pending`, `approved`, or `rejected`. |
| `requestedAt` | Date | Request timestamp. |
| `resolvedAt` | Date | Approval/rejection timestamp. |
| `resolvedBy` | ObjectId | Admin who resolved the request. |

## 7. Message Collection

Collection name: `messages`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | MongoDB primary key. |
| `roomId` | ObjectId | Conditional | Room that owns a room-chat message. |
| `conversationId` | ObjectId | Conditional | Direct conversation that owns a direct message. |
| `senderId` | ObjectId | Yes | User who sent the message. |
| `content` | String | Conditional | Text content, media caption, filename fallback, or delete placeholder. |
| `type` | String enum | Yes | `text`, `system`, `image`, `video`, `file`, or `audio`. |
| `attachments` | ObjectId[] | No | References media attachment metadata. |
| `timestamp` | Date | Yes | Message creation time. |
| `status` | String enum | Yes | `sent`, `delivered`, `read`, or `failed`. |
| `replyToMessageId` | ObjectId | No | Original message being quoted. |
| `reactions` | Array | No | One emoji reaction per user. |
| `deliveredTo` | Array | No | Per-user delivery receipts. |
| `readBy` | Array | No | Per-user read receipts. |
| `editedAt` | Date | No | Set when the sender edits a text message. |
| `deletedAt` | Date | No | Set when the sender deletes for everyone. |
| `isDeleted` | Boolean | Yes | Soft-delete flag. |
| `hiddenFor` | ObjectId[] | No | Optional per-user hidden state for future delete-for-me behavior. |
| `expiresAt` | Date | No | Expiry timestamp for disappearing messages. |
| `isEncrypted` | Boolean | Yes | True when content is client-side encryption demo ciphertext. |
| `encryptionMetadata` | Object | No | Demo algorithm/IV/warning metadata. |
| `createdAt`, `updatedAt` | Date | Yes | Mongoose timestamps. |

Reaction subdocument:

| Field | Type | Description |
| --- | --- | --- |
| `userId` | ObjectId | Reacting user. |
| `emoji` | String | One of 👍 ❤️ 😂 😮 😢 🙏. |
| `createdAt` | Date | Reaction timestamp. |

Receipt subdocument:

| Field | Type | Description |
| --- | --- | --- |
| `userId` | ObjectId | Recipient user. |
| `at` | Date | Delivery/read timestamp. |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ roomId: 1, timestamp: -1 }` | Fast latest-message retrieval by room. |
| `{ roomId: 1, _id: -1 }` | Efficient room cursor pagination. |
| `{ conversationId: 1, timestamp: -1 }` | Fast latest-message retrieval by direct chat. |
| `{ conversationId: 1, _id: -1 }` | Efficient direct-message cursor pagination. |
| `{ conversationId: 1, content: "text" }` | Conversation-scoped text search support. |
| `{ senderId: 1, timestamp: -1 }` | Sender activity queries. |
| `{ "readBy.userId": 1 }` | Unread count and receipt queries. |
| `{ expiresAt: 1 }` | Expiring-message filtering and cleanup worker queries. |

Encryption metadata:

| Field | Type | Description |
| --- | --- | --- |
| `algorithm` | String | Demo algorithm, currently `AES-GCM` when Web Crypto is available. |
| `iv` | String | Base64 IV used by the client for demo decryption. |
| `demoWarning` | String | Stored reminder that this is not production E2EE. |

Direct media message shape:

```json
{
  "id": "6652f514610b1b63e7d71103",
  "conversationId": "6652f40e610b1b63e7d71110",
  "sender": {
    "id": "6652f2d0610b1b63e7d71101",
    "username": "shriya"
  },
  "content": "voice-note.webm",
  "type": "audio",
  "attachments": [
    {
      "id": "6652f2d0610b1b63e7d71199",
      "kind": "audio",
      "originalFilename": "voice-note.webm",
      "mimeType": "audio/webm",
      "size": 12044,
      "url": "/api/attachments/6652f2d0610b1b63e7d71199/content"
    }
  ],
  "status": "delivered",
  "expiresAt": null,
  "isEncrypted": false,
  "encryptionMetadata": null,
  "timestamp": "2026-05-31T18:30:00.000Z"
}
```

## 8. Report Collection

Collection name: `reports`

Reports are local MongoDB records. No external moderation API is called.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | MongoDB primary key. |
| `type` | String enum | Yes | `user` or `message`. |
| `reporterId` | ObjectId | Yes | User who created the report. |
| `reportedUserId` | ObjectId | No | User being reported. |
| `messageId` | ObjectId | No | Message being reported. |
| `conversationId` | ObjectId | No | Direct conversation context. |
| `roomId` | ObjectId | No | Room/group context. |
| `reason` | String | No | Local moderation note. |
| `status` | String enum | Yes | `open`, `reviewed`, or `dismissed`. |
| `createdAt`, `updatedAt` | Date | Yes | Mongoose timestamps. |

Indexes:

| Index | Purpose |
| --- | --- |
| `{ status: 1, createdAt: -1 }` | Moderation queue ordering. |
| `{ reporterId: 1, createdAt: -1 }` | Reporter history lookup. |

## 9. Relationships

```text
User 1 --- many Room.members
User 1 --- many Message.senderId
User 1 --- many Attachment.ownerId
User 1 --- many Conversation.settings.userId
User 1 --- many User.blockedUsers
User 1 --- many Report.reporterId
User 1 --- many Report.reportedUserId
Room 1 --- many Message.roomId
User 1 --- many Room.createdBy
User 1 --- many Room.ownerId/admins
User 2 --- many Conversation.participants
Conversation 1 --- many Message.conversationId
Conversation 1 --- many Attachment.conversationId
Message 1 --- many Message.replyToMessageId
Message many --- many Attachment.attachments
Message 1 --- many Report.messageId
```

## 10. Redis Data Model

| Key | Value | Expiration |
| --- | --- | --- |
| `online:<userId>` | JSON metadata or ISO timestamp | `ONLINE_USER_TTL_SECONDS`, default 3600 seconds |
| `messages:<roomId>` | List of serialized room message payloads | `MESSAGE_CACHE_TTL_SECONDS`, default 86400 seconds |
| `blacklist:<token>` | `1` | Remaining JWT lifetime |
| `typing:<roomId>:<userId>` | `1` | 3 seconds |

## 11. Local File Storage

| Path | Purpose |
| --- | --- |
| `server/uploads/.gitkeep` | Keeps the upload directory present in source control. |
| `server/uploads/*` | Ignored local development files. |
| `/app/uploads` | Docker server upload mount. |
| `server-uploads` | Docker Compose named volume for uploaded media. |

The storage service owns path generation and file validation. Route handlers and message logic use attachment IDs and protected URLs rather than filesystem paths.

## 12. Data Integrity Rules

- A private room message can only be created by a room member.
- A direct message can only be created by one of the two conversation participants.
- Direct conversations must contain exactly two unique users and cannot be duplicated for the same pair.
- Message attachments must belong to the same conversation as the outgoing direct message.
- Only participants can download message attachments.
- Read receipts, reactions, edits, deletes, settings, and searches are authorized server-side.
- Only senders can edit text messages or delete their own direct messages for everyone.
- Muted, pinned, and archived settings are per user and do not change the other participant's settings.
- Locked chats are per user and unlock with a short-lived `unlockedUntil` value after account password or bcrypt-hashed local PIN validation.
- Blocked users cannot send direct messages to the blocker.
- Reports are stored locally and listed only for users with `isAdmin: true`.
- Expired messages are filtered from APIs and socket history; the cleanup worker soft-deletes them and emits `message:expired`.
- Encrypted demo messages store ciphertext in `content`; symmetric keys are generated and stored only by the browser demo client.
- Group member/admin/owner actions are authorized server-side.
- User deletion is not part of this release to keep message attribution stable.
