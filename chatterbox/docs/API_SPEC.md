<!-- Purpose: Legacy REST and Socket.io API contract for ChatterBox v1 room chat. See API.md for current direct/media messaging. -->

# API Specification

> Version 4.0.0 keeps this preserved room-chat contract and adds WebRTC calls, statuses, channels, sessions, scaling hooks, dashboard metrics, managed groups, privacy settings, disappearing messages, locked chats, local reports, and an encryption demo. The current full API reference is maintained in [API.md](API.md).

## 1. Overview

The ChatterBox API has two interfaces:

- REST endpoints under `/api` for authentication, users, rooms, and message history.
- Socket.io events for low-latency room communication, typing indicators, and presence updates.

## 2. Base URLs

| Environment | REST URL | Socket URL |
| --- | --- | --- |
| Local backend | `http://localhost:5000/api` | `http://localhost:5000` |
| Docker local | `http://localhost:5000/api` | `http://localhost:5000` |

## 3. Authentication

Protected REST endpoints require:

```http
Authorization: Bearer <jwt>
```

Socket.io clients authenticate with:

```js
io("http://localhost:5000", {
  auth: { token: "<jwt>" }
});
```

## 4. Standard Response Format

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": []
  }
}
```

## 5. REST Endpoints

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Returns service health and dependency status. |

Healthy response:

```json
{
  "success": true,
  "data": {
    "service": "chatterbox-server",
    "status": "ok",
    "uptimeSeconds": 120,
    "mongodb": "ready",
    "redis": "ready"
  }
}
```

The route returns HTTP `503` with `status: "degraded"` if MongoDB or Redis is not ready.

### Auth Routes

#### POST `/api/auth/register`

Creates a user account and returns a JWT.

Request:

```json
{
  "username": "shriya",
  "email": "shriya@example.com",
  "password": "StrongPassword123!"
}
```

Responses:

| Status | Meaning |
| --- | --- |
| 201 | User created and token returned. |
| 400 | Invalid input. |
| 409 | Email or username already exists. |

#### POST `/api/auth/login`

Authenticates a user and returns a JWT.

Request:

```json
{
  "email": "shriya@example.com",
  "password": "StrongPassword123!"
}
```

Responses:

| Status | Meaning |
| --- | --- |
| 200 | Login successful. |
| 400 | Invalid input. |
| 401 | Invalid credentials. |

#### POST `/api/auth/logout`

Blacklists the current JWT until expiry.

| Status | Meaning |
| --- | --- |
| 200 | Logout successful. |
| 401 | Missing, invalid, expired, or blacklisted token. |

#### GET `/api/auth/me`

Returns the authenticated user's sanitized profile.

| Status | Meaning |
| --- | --- |
| 200 | Current user returned. |
| 401 | Missing or invalid token. |

### User Routes

#### GET `/api/users?search=<query>`

Searches users by username or email prefix/text match.

| Status | Meaning |
| --- | --- |
| 200 | Matching users returned. |
| 401 | Unauthorized. |

#### GET `/api/users/:id`

Returns a public user profile by ID.

| Status | Meaning |
| --- | --- |
| 200 | User profile returned. |
| 400 | Invalid user ID. |
| 404 | User not found. |

### Room Routes

#### POST `/api/rooms`

Creates a public or private room.

Request:

```json
{
  "name": "General",
  "type": "public",
  "members": []
}
```

| Status | Meaning |
| --- | --- |
| 201 | Room created. |
| 400 | Invalid room payload. |
| 401 | Unauthorized. |

#### GET `/api/rooms`

Returns rooms visible to the current user.

| Query | Description |
| --- | --- |
| `type` | Optional `public` or `private` filter. |
| `search` | Optional name search. |

#### GET `/api/rooms/:id`

Returns room details if the user can access the room.

| Status | Meaning |
| --- | --- |
| 200 | Room returned. |
| 403 | User cannot access private room. |
| 404 | Room not found. |

#### POST `/api/rooms/:id/members`

Adds a member to a private room.

Request:

```json
{
  "userId": "6652f2d0610b1b63e7d71101"
}
```

#### DELETE `/api/rooms/:id/members/me`

Removes the current user from a room.

#### GET `/api/rooms/:id/messages`

Returns chronological message history using an efficient older-message cursor. Access follows public/private room visibility rules.

| Query | Default | Description |
| --- | --- | --- |
| `limit` | `50` | Maximum messages returned. |
| `before` | none | Cursor ObjectId for older messages. |

Response:

```json
{
  "success": true,
  "data": {
    "messages": [],
    "pagination": {
      "hasMore": true,
      "limit": 50,
      "nextCursor": "6652f514610b1b63e7d71103"
    }
  }
}
```

`nextCursor` is `null` once there are no older messages.

## 6. Socket.io Events

### Connection

#### `connect`

Client connects with JWT in handshake auth.

Server behavior:

- verifies JWT
- attaches sanitized user to socket
- stores online presence in Redis
- emits `user_online`

#### `disconnect`

Server behavior:

- clears Redis presence key
- updates user `lastSeen`
- emits `user_offline`

### Room Events

#### Client emits `join_room`

Payload:

```json
{
  "roomId": "6652f40e610b1b63e7d71102"
}
```

Server emits to sender:

- `message_history`
- `socket_error` if validation or authorization fails

Successful `message_history` payload:

```json
{
  "roomId": "6652f40e610b1b63e7d71102",
  "messages": [],
  "source": "cache"
}
```

The `source` field is `cache` when Redis served recent messages and `database` when MongoDB served history and Redis was warmed.

#### Client emits `leave_room`

Payload:

```json
{
  "roomId": "6652f40e610b1b63e7d71102"
}
```

Server removes socket from the room and may emit room presence updates.

### Message Events

#### Client emits `send_message`

Payload:

```json
{
  "roomId": "6652f40e610b1b63e7d71102",
  "content": "Hello from ChatterBox!",
  "clientMessageId": "client-generated-id"
}
```

Server behavior:

- validates content
- confirms room access
- saves message to MongoDB
- caches message in Redis
- emits `receive_message` to room
- publishes delivery event to Azure Service Bus

#### Server emits `receive_message`

Payload:

```json
{
  "id": "6652f514610b1b63e7d71103",
  "roomId": "6652f40e610b1b63e7d71102",
  "sender": {
    "id": "6652f2d0610b1b63e7d71101",
    "username": "shriya"
  },
  "content": "Hello from ChatterBox!",
  "type": "text",
  "timestamp": "2026-05-24T00:05:00.000Z",
  "status": "delivered",
  "clientMessageId": "client-generated-id"
}
```

### Typing Events

#### Client emits `user_typing`

Payload:

```json
{
  "roomId": "6652f40e610b1b63e7d71102",
  "isTyping": true
}
```

Server emits `typing_indicator` to other room members:

```json
{
  "roomId": "6652f40e610b1b63e7d71102",
  "userId": "6652f2d0610b1b63e7d71101",
  "username": "shriya",
  "isTyping": true
}
```

### Presence Events

#### Server emits `user_online`

```json
{
  "userId": "6652f2d0610b1b63e7d71101",
  "username": "shriya",
  "onlineAt": "2026-05-24T00:00:00.000Z"
}
```

#### Server emits `user_offline`

```json
{
  "userId": "6652f2d0610b1b63e7d71101",
  "username": "shriya",
  "lastSeen": "2026-05-24T00:10:00.000Z"
}
```

#### Server emits `online_users`

Sent to a newly connected user after presence registration:

```json
[
  {
    "userId": "6652f2d0610b1b63e7d71101",
    "username": "shriya",
    "onlineAt": "2026-05-24T00:00:00.000Z"
  }
]
```

### Error Event

#### Server emits `socket_error`

```json
{
  "code": "ROOM_ACCESS_DENIED",
  "message": "You do not have access to this room.",
  "details": {}
}
```

## 7. Status Code Reference

| Status | Meaning |
| --- | --- |
| 200 | Successful request. |
| 201 | Resource created. |
| 400 | Validation or malformed request error. |
| 401 | Authentication required or invalid token. |
| 403 | Authenticated but not authorized. |
| 404 | Resource not found. |
| 409 | Conflict such as duplicate user data. |
| 429 | Rate limit exceeded. |
| 500 | Unexpected server error. |
| 503 | Required dependency unavailable. |
