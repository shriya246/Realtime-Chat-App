<!-- Purpose: MongoDB and Mongoose schema reference for ChatterBox. -->

# Database Schema

## 1. Overview

ChatterBox stores durable data in MongoDB using Mongoose schemas. Redis stores transient cache and presence data, but MongoDB remains the source of truth for users, rooms, and messages.

## 2. Common Conventions

- Primary identifiers use MongoDB ObjectId values.
- API responses expose `id` as a string derived from `_id`.
- Timestamps use UTC dates.
- Sensitive fields such as `passwordHash` are never returned to clients.
- Mongoose schema validation is paired with request-level validation.

## 3. User Collection

Collection name: `users`

### Fields

| Field | Type | Required | Unique | Description |
| --- | --- | --- | --- | --- |
| `_id` | ObjectId | Yes | Yes | MongoDB primary key. |
| `username` | String | Yes | Yes | Public display name and searchable handle. |
| `email` | String | Yes | Yes | Lowercased login identifier. |
| `passwordHash` | String | Yes | No | bcrypt hash of the user password. |
| `createdAt` | Date | Yes | No | Account creation timestamp. |
| `updatedAt` | Date | Yes | No | Last document update timestamp. |
| `lastSeen` | Date | No | No | Last known disconnect or activity timestamp. |

### Validation Rules

| Field | Rule |
| --- | --- |
| `username` | Trimmed, 3-30 characters, alphanumeric plus underscore and hyphen. |
| `email` | Trimmed, lowercased, valid email format. |
| `passwordHash` | Required and stored only after bcrypt hashing. |

### Indexes

| Index | Purpose |
| --- | --- |
| `{ email: 1 }` unique | Fast login lookup and duplicate prevention. |
| `{ username: 1 }` unique | Fast profile lookup and duplicate prevention. |
| `{ username: "text", email: "text" }` | User search. |

### API Shape

```json
{
  "id": "6652f2d0610b1b63e7d71101",
  "username": "shriya",
  "email": "shriya@example.com",
  "createdAt": "2026-05-24T00:00:00.000Z",
  "lastSeen": "2026-05-24T00:10:00.000Z"
}
```

## 4. Room Collection

Collection name: `rooms`

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | MongoDB primary key. |
| `name` | String | Yes | Human-readable room name. |
| `type` | String enum | Yes | `public` or `private`. |
| `members` | ObjectId[] | Yes | References to users allowed in the room. |
| `createdBy` | ObjectId | Yes | User who created the room. |
| `createdAt` | Date | Yes | Creation timestamp. |
| `updatedAt` | Date | Yes | Last update timestamp. |

### Validation Rules

| Field | Rule |
| --- | --- |
| `name` | Trimmed, 1-80 characters. |
| `type` | Must be `public` or `private`. |
| `members` | Must contain at least the creator. |

### Indexes

| Index | Purpose |
| --- | --- |
| `{ name: 1, type: 1 }` | Room search and filtering. |
| `{ members: 1 }` | Fast lookup for rooms visible to a user. |
| `{ createdBy: 1 }` | Creator-based room queries. |

### Virtuals

| Virtual | Description |
| --- | --- |
| `memberCount` | Number of users in the room. |
| `isPrivate` | Boolean derived from `type === "private"`. |

### API Shape

```json
{
  "id": "6652f40e610b1b63e7d71102",
  "name": "General",
  "type": "public",
  "members": ["6652f2d0610b1b63e7d71101"],
  "memberCount": 1,
  "createdBy": "6652f2d0610b1b63e7d71101",
  "createdAt": "2026-05-24T00:00:00.000Z"
}
```

## 5. Message Collection

Collection name: `messages`

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `_id` | ObjectId | Yes | MongoDB primary key. |
| `roomId` | ObjectId | Yes | Room that owns the message. |
| `senderId` | ObjectId | Yes | User who sent the message. |
| `content` | String | Yes | Plain-text message body. |
| `type` | String enum | Yes | `text`, `system`, or future-safe message type. |
| `timestamp` | Date | Yes | Message creation time. |
| `status` | String enum | Yes | `sent`, `delivered`, `read`, or `failed`. |
| `createdAt` | Date | Yes | Persistence timestamp. |
| `updatedAt` | Date | Yes | Last status update timestamp. |

### Validation Rules

| Field | Rule |
| --- | --- |
| `roomId` | Must reference an existing room. |
| `senderId` | Must reference an existing user. |
| `content` | Trimmed, 1-2000 characters for text messages. |
| `type` | Defaults to `text`. |
| `status` | Defaults to `sent`. |

### Indexes

| Index | Purpose |
| --- | --- |
| `{ roomId: 1, timestamp: -1 }` | Fast latest-message retrieval by room. |
| `{ roomId: 1, _id: -1 }` | Efficient cursor pagination. |
| `{ senderId: 1, timestamp: -1 }` | Sender activity queries. |

### API Shape

```json
{
  "id": "6652f514610b1b63e7d71103",
  "roomId": "6652f40e610b1b63e7d71102",
  "senderId": {
    "id": "6652f2d0610b1b63e7d71101",
    "username": "shriya"
  },
  "content": "Hello from ChatterBox!",
  "type": "text",
  "timestamp": "2026-05-24T00:05:00.000Z",
  "status": "delivered"
}
```

## 6. Relationships

```text
User 1 --- many Room.members
User 1 --- many Message.senderId
Room 1 --- many Message.roomId
User 1 --- many Room.createdBy
```

## 7. Redis Data Model

| Key | Value | Expiration |
| --- | --- | --- |
| `online:<userId>` | JSON metadata or ISO timestamp | 3600 seconds |
| `messages:<roomId>` | List of serialized message payloads | 86400 seconds |
| `blacklist:<token>` | `1` | Remaining JWT lifetime |
| `typing:<roomId>:<userId>` | `1` | 3 seconds |

## 8. Data Integrity Rules

- A private room message can only be created by a room member.
- A public room message can only be created by an authenticated user who has joined the room.
- Deleting a room is not part of the initial version; leaving a room removes membership only.
- Message records are append-only except for status transitions.
- User deletion is not part of the initial version to keep message attribution stable.
