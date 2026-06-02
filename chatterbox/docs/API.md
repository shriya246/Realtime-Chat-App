<!-- Purpose: Version 3.0.0 REST and Socket.io API reference for direct, media, profile, privacy, and group chat. -->

# API Reference

All protected REST endpoints require `Authorization: Bearer <jwt>`. Socket.io clients authenticate with `auth: { token }`.

## Auth and Users

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account and return JWT plus sanitized profile. |
| `POST` | `/api/auth/login` | Authenticate and return JWT plus sanitized profile. |
| `POST` | `/api/auth/logout` | Blacklist the active token until expiry. |
| `GET` | `/api/auth/me` | Return the signed-in user. |
| `GET` | `/api/users?search=` | Search users by username/email/display metadata for starting chats. |
| `GET` | `/api/users/:id` | Return a public user profile. |
| `PATCH` | `/api/users/me` | Update `displayName`, `about`, and optional `avatarAttachmentId`. |
| `PATCH` | `/api/users/me/privacy` | Update privacy settings for last seen, online, read receipts, profile photo, and about. |
| `POST` | `/api/users/:id/block` | Block a user from sending direct messages to the signed-in user. |
| `DELETE` | `/api/users/:id/block` | Unblock a previously blocked user. |

Profile update body:

```json
{
  "displayName": "Shriya Patel",
  "about": "Building local-first chat tools.",
  "avatarAttachmentId": "6652f40e610b1b63e7d71110"
}
```

User response shape:

```json
{
  "id": "6652f2d0610b1b63e7d71101",
  "username": "shriya",
  "email": "shriya@example.com",
  "displayName": "Shriya Patel",
  "about": "Building local-first chat tools.",
  "avatarUrl": "/api/attachments/6652f40e610b1b63e7d71110/content"
}
```

Privacy update body:

```json
{
  "lastSeenVisibility": "contacts",
  "onlineVisibility": "everyone",
  "readReceipts": false,
  "profilePhotoVisibility": "contacts",
  "aboutVisibility": "nobody"
}
```

Visibility values are `everyone`, `contacts`, or `nobody`. `readReceipts: false` prevents direct-chat read updates from being emitted by the current user.

## Attachments

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/attachments?purpose=message&conversationId=:id` | Upload an attachment for a direct conversation. |
| `POST` | `/api/attachments?purpose=avatar` | Upload an avatar image for the signed-in user. |
| `GET` | `/api/attachments/:id/content` | Stream an authorized attachment. |

Upload requests send the file as the raw request body. The server reads `Content-Type` for MIME validation and `X-File-Name` for the original file name. Message attachments require the uploader to be a conversation participant. Avatar uploads require image MIME types.

Attachment response shape:

```json
{
  "id": "6652f40e610b1b63e7d71110",
  "ownerId": "6652f2d0610b1b63e7d71101",
  "conversationId": "6652f40e610b1b63e7d71109",
  "purpose": "message",
  "kind": "image",
  "originalFilename": "photo.png",
  "storedFilename": "1717180800000-8fd91c-photo.png",
  "mimeType": "image/png",
  "size": 24812,
  "duration": null,
  "width": null,
  "height": null,
  "url": "/api/attachments/6652f40e610b1b63e7d71110/content"
}
```

Security rules:

- Allowed categories: common image, video, audio, PDF, and text files.
- Default maximum size: `MAX_UPLOAD_FILE_SIZE_BYTES=10485760`.
- Dangerous executable extensions and executable MIME types are rejected.
- Message attachment bytes are served only to participants in the owning conversation.
- Avatar bytes are served only to authenticated users.
- Files are stored under `UPLOAD_DIR` through a storage service abstraction.

## Direct Conversations

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/conversations/direct` | Create or get the one-to-one conversation for `targetUserId`. |
| `GET` | `/api/conversations?search=` | List my conversations with participant info, last message preview, timestamp, unread count, online flag, and per-user settings. |
| `GET` | `/api/conversations/:id/messages?limit=&before=` | Load direct-message history using ObjectId cursor pagination. |
| `GET` | `/api/conversations/:id/search?q=&limit=` | Search text messages inside one authorized conversation. |
| `POST` | `/api/conversations/:id/read` | Mark unread messages in the direct conversation as read. |
| `PATCH` | `/api/conversations/:id/settings` | Update my `pinned`, `archived`, `muted`, or `locked` setting for the conversation. |
| `PATCH` | `/api/conversations/locked-pin` | Set or rotate the signed-in user's local locked-chat PIN hash. |
| `POST` | `/api/conversations/:id/unlock` | Unlock a locked chat with account password or local PIN for the current session window. |
| `PATCH` | `/api/conversations/:id/disappearing` | Set direct-chat disappearing message mode. |
| `PATCH` | `/api/conversations/:id/encryption` | Enable or disable the direct-chat encryption demo flag. |

Create/get direct conversation:

```json
{
  "targetUserId": "6652f2d0610b1b63e7d71102"
}
```

Conversation settings update:

```json
{
  "pinned": true,
  "archived": false,
  "muted": true,
  "locked": false
}
```

Locked PIN and unlock bodies:

```json
{ "pin": "123456" }
```

```json
{ "pin": "123456" }
```

or:

```json
{ "password": "account-password" }
```

Disappearing and encryption bodies:

```json
{ "mode": "7d" }
```

```json
{ "enabled": true }
```

Disappearing `mode` values are `off`, `24h`, `7d`, and `90d`.

Conversation list item:

```json
{
  "id": "6652f40e610b1b63e7d71110",
  "type": "direct",
  "participant": {
    "id": "6652f2d0610b1b63e7d71102",
    "username": "alex",
    "displayName": "Alex Rivera",
    "email": "alex@example.com",
    "avatarUrl": "/api/attachments/6652f40e610b1b63e7d71112/content",
    "isOnline": true
  },
  "lastMessagePreview": "Image attachment",
  "lastMessageTimestamp": "2026-05-31T18:30:00.000Z",
  "settings": {
    "pinned": true,
    "archived": false,
    "muted": false,
    "locked": false,
    "unlockedUntil": null
  },
  "disappearingMode": "off",
  "encryptedModeEnabled": false,
  "unreadCount": 2
}
```

Direct message response:

```json
{
  "id": "6652f514610b1b63e7d71103",
  "conversationId": "6652f40e610b1b63e7d71110",
  "sender": {
    "id": "6652f2d0610b1b63e7d71101",
    "username": "shriya"
  },
  "content": "Photo from today",
  "type": "image",
  "attachments": [
    {
      "id": "6652f40e610b1b63e7d71110",
      "kind": "image",
      "originalFilename": "photo.png",
      "mimeType": "image/png",
      "size": 24812,
      "url": "/api/attachments/6652f40e610b1b63e7d71110/content"
    }
  ],
  "replyTo": null,
  "reactions": [],
  "status": "delivered",
  "expiresAt": null,
  "isEncrypted": false,
  "encryptionMetadata": null,
  "timestamp": "2026-05-31T18:30:00.000Z"
}
```

Encrypted demo messages send ciphertext in `content` and include:

```json
{
  "isEncrypted": true,
  "encryptionMetadata": {
    "algorithm": "AES-GCM",
    "iv": "base64-iv",
    "demoWarning": "Demo only; key storage is localStorage."
  }
}
```

The server stores ciphertext only for encrypted demo messages. Key generation, encryption, and decryption happen in the browser.

## Rooms

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms` | Create a public or private room. |
| `GET` | `/api/rooms?type=&search=` | List visible rooms. |
| `GET` | `/api/rooms/:id` | Return an accessible room. |
| `GET` | `/api/rooms/:id/messages?limit=&before=` | Load cursor-paginated room history. |
| `POST` | `/api/rooms/:id/members` | Add a private-room member. |
| `PATCH` | `/api/rooms/:id` | Update group name, description, avatar, or group settings when authorized. |
| `DELETE` | `/api/rooms/:id` | Delete a group when the signed-in user is the owner. |
| `DELETE` | `/api/rooms/:id/members/:userId` | Remove a group member when the signed-in user is an admin. |
| `PATCH` | `/api/rooms/:id/admins/:userId` | Promote or demote an admin when the signed-in user is owner/admin. |
| `POST` | `/api/rooms/:id/invite` | Generate, reset, or revoke an invite token. |
| `POST` | `/api/rooms/join/:token` | Join a group by invite token or create a join request if approval is enabled. |
| `POST` | `/api/rooms/:id/join-requests/:userId` | Approve or reject a pending join request. |
| `DELETE` | `/api/rooms/:id/members/me` | Leave a room. |

Room chat remains preserved from v1 and now supports WhatsApp-style group management. Group roles are `owner`, `admin`, and `member`. Owners can delete groups and manage admins. Admins can add/remove members, manage invite links, and update settings when allowed.

Group settings body:

```json
{
  "name": "Launch crew",
  "description": "Private launch planning",
  "settings": {
    "whoCanSendMessages": "admins",
    "whoCanEditInfo": "admins",
    "newMembersCanSeeRecentHistory": true,
    "joinApprovalRequired": true,
    "disappearingMode": "24h"
  }
}
```

Invite reset/revoke body:

```json
{ "action": "reset" }
```

Join-request resolution body:

```json
{ "action": "approve" }
```

## Reports

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/reports` | Store a local user or message report. |
| `GET` | `/api/reports` | Return local reports for signed-in users with `isAdmin: true`. |

Report body:

```json
{
  "type": "message",
  "reportedUserId": "6652f2d0610b1b63e7d71102",
  "messageId": "6652f514610b1b63e7d71103",
  "conversationId": "6652f40e610b1b63e7d71110",
  "reason": "Harassment"
}
```

## Direct Socket.io Events

| Direction | Event | Purpose |
| --- | --- | --- |
| Client -> Server | `conversation:join` | Join an authorized direct-conversation socket room. |
| Client -> Server | `conversation:leave` | Leave a direct-conversation socket room. |
| Client -> Server | `direct_message:send` | Send a direct text or media message. |
| Server -> Client | `direct_message:new` | Deliver any new direct message to both participants. |
| Server -> Client | `media_message:new` | Additional media-specific delivery event for image/video/file/audio messages. |
| Client -> Server | `message:delivered` | Record delivery for a direct message. |
| Client -> Server | `message:read` | Mark a conversation as read. |
| Server -> Client | `message:read` | Broadcast read receipt updates. |
| Client -> Server | `message:reaction:update` | Add, change, or remove the current user's reaction. |
| Server -> Client | `message:reaction:update` | Broadcast aggregated reaction updates. |
| Client -> Server | `message:edit` | Edit the sender's own text message. |
| Server -> Client | `message:edit` | Broadcast edited message payload. |
| Client -> Server | `message:delete` | Soft delete the sender's own message for everyone. |
| Server -> Client | `message:delete` | Broadcast deleted-message placeholder. |
| Client -> Server | `conversation:settings:update` | Update `pinned`, `archived`, `muted`, or `locked` for the current user. |
| Server -> Client | `conversation:settings:update` | Confirm settings changes for the current user. |
| Client -> Server | `conversation:disappearing:update` | Update direct-chat disappearing mode. |
| Client -> Server | `conversation:encryption:update` | Update the direct-chat encrypted-demo flag. |
| Client -> Server | `profile:update` | Update profile fields over the socket path. |
| Server -> Client | `profile:update` | Broadcast sanitized profile changes. |
| Client -> Server | `user:block` | Block or unblock a user over the socket path. |
| Client -> Server | `report:create` | Store a local user or message report over the socket path. |
| Client -> Server | `chat:locked` | Update locked-chat state. |
| Server -> Client | `conversation:updated` | Refresh conversation-list preview and unread counts. |

`direct_message:send` payload:

```json
{
  "conversationId": "6652f40e610b1b63e7d71110",
  "clientMessageId": "client-123",
  "content": "See attached",
  "replyToMessageId": "6652f514610b1b63e7d71103",
  "attachmentId": "6652f40e610b1b63e7d71110",
  "isEncrypted": false,
  "encryptionMetadata": null
}
```

Supported reactions: 👍 ❤️ 😂 😮 😢 🙏

## Room Socket.io Events

| Direction | Event | Purpose |
| --- | --- | --- |
| Client -> Server | `join_room` | Join an accessible room and receive recent history. |
| Client -> Server | `leave_room` | Leave an active room. |
| Client -> Server | `send_message` | Persist and broadcast a room message. |
| Client -> Server | `user_typing` | Broadcast typing state. |
| Client -> Server | `group:update` | Update group details/settings when authorized. |
| Client -> Server | `group:member:add` | Add a group member when authorized. |
| Client -> Server | `group:member:remove` | Remove a group member when authorized. |
| Client -> Server | `group:admin:update` | Promote or demote a group admin. |
| Client -> Server | `group:join_request:resolved` | Approve or reject a pending join request. |
| Server -> Client | `message_history` | Deliver room history. |
| Server -> Client | `receive_message` | Deliver a live room message. |
| Server -> Client | `group:join_request:new` | Notify admins of a new join request. |
| Server -> Client | `group:join_request:resolved` | Notify clients that a join request was resolved. |
| Server -> Client | `message:expired` | Notify clients that a disappearing message expired. |
| Server -> Client | `typing_indicator` | Show or clear typing state. |
| Server -> Client | `online_users`, `user_online`, `user_offline` | Presence state. |
| Server -> Client | `socket_error` | Normalized socket event failure. |

## Error Shape

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "targetUserId",
        "message": "Target user ID must be a valid ObjectId."
      }
    ]
  }
}
```

## Free Local Integrations

Version 3.0.0 defaults to `EVENT_PUBLISHER=noop`, which records no external queue dependency. Azure Service Bus remains optional for users who provide their own credentials and set `EVENT_PUBLISHER=azure`. Local media storage uses the server filesystem and Docker volume. Browser notifications, voice notes, privacy controls, locked-chat PINs, disappearing-message cleanup, reports, and the encryption demo use local, open-source, or browser-native resources. No paid service is required for local development, tests, CI, Docker Compose, or v3.0.0 features.
