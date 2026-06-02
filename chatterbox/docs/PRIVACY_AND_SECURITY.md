<!-- Purpose: Privacy, moderation, locked-chat, disappearing-message, and encryption-demo notes for ChatterBox v3.0.0. -->

# Privacy and Security

## v3.0.0 Scope

ChatterBox v3.0.0 adds privacy controls, managed groups, block/report flows, disappearing messages, locked chats, and a basic client-side encryption demo. These features are built with free, local, open-source, or browser-native resources:

- MongoDB for durable chat, privacy, group, report, and message records
- Redis for local presence/cache/JWT blacklist state
- Local filesystem uploads for media and avatars
- bcrypt for passwords and local locked-chat PIN hashes
- Socket.io for real-time events
- Browser Notification API, MediaRecorder API, and Web Crypto API
- Local Node interval for disappearing-message cleanup

No external SMS, email, push, identity, moderation, scheduler, storage, or encryption service is required.

## Privacy Controls

User privacy settings are stored on the user document:

- `lastSeenVisibility`
- `onlineVisibility`
- `readReceipts`
- `profilePhotoVisibility`
- `aboutVisibility`

Visibility values are `everyone`, `contacts`, and `nobody`. Read receipts can be disabled independently; when disabled, the server skips direct-chat read updates for that user.

## Blocking

Blocked users are stored locally in `users.blockedUsers`. When a direct message is sent, the server checks whether the sender is blocked by the recipient before persisting or emitting the message. User search also avoids surfacing users blocked by the current user where appropriate.

## Reports and Moderation

Reports are stored in the local `reports` MongoDB collection. Reports can target a user or a message and may include conversation or room context. The report list is protected by the local `isAdmin` flag on the user record.

There is no external moderation API. This keeps the app local and free, but it also means automated content classification, abuse triage, and external trust/safety workflows are outside this release.

## Disappearing Messages

Direct conversations and groups support:

- `off`
- `24h`
- `7d`
- `90d`

The server calculates `expiresAt` when a message is created. History and search APIs filter expired messages. A local Node interval soft-deletes expired messages and emits `message:expired`.

This is app-level disappearing behavior. It does not prevent screenshots, copied text, downloaded media, browser cache artifacts, database backups, or previously delivered client copies.

## Locked Chats

Locked chats are per-user conversation settings. When a chat is locked:

- the UI shows an unlock form instead of the message stream
- the history endpoint rejects access until unlock succeeds
- unlock accepts the account password or a local PIN
- the local PIN is stored as a bcrypt hash
- successful unlock sets a short-lived `unlockedUntil`

Locked chats are web-app-level privacy. They are not device biometric security, full-disk encryption, or protection against a compromised browser session.

## Client-Side Encryption Demo

The encrypted direct-chat mode is a portfolio/demo implementation.

What it does:

- generates a symmetric conversation key in the browser
- stores the demo key in browser `localStorage`
- encrypts outgoing text content before sending
- stores ciphertext and encryption metadata on the server
- decrypts on render only when the local demo key is available

What it does not do:

- it is not production-grade WhatsApp E2EE
- it does not implement Signal protocol
- it does not provide secure key exchange
- it does not provide forward secrecy
- it does not verify devices or identities
- it does not protect keys with hardware-backed or biometric storage
- it does not solve secure multi-device sync

Use the encryption demo to show client-side ciphertext flow, not to make production security claims.

## Optional Cloud Services

Azure Service Bus remains optional and disabled by default with `EVENT_PUBLISHER=noop`. Local development, tests, CI, and Docker Compose do not require Azure, AWS, Firebase, Twilio, SendGrid, Pusher, Cloudinary, or any paid SaaS dependency.
