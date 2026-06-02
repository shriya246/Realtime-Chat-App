<!-- Purpose: Test strategy and test-case catalog for ChatterBox v3.0.0. -->

# Test Plan

## 1. Purpose

This test plan defines how ChatterBox is validated across backend APIs, Socket.io workflows, React components, local storage behavior, runtime configuration, and deployment readiness. Version 3.0.0 extends the plan for group management, invite/join approval, disappearing messages, block/report flows, locked chats, privacy settings, and the client-side encryption demo while preserving v1 room chat, v2 direct messaging, and v2.5 media/profile features.

## 2. Test Objectives

- Verify authentication, authorization, and safe error behavior.
- Verify room membership, room messages, Redis cache, typing, and presence.
- Verify direct conversation uniqueness, unread counts, read receipts, replies, reactions, edit/delete, and optimistic states.
- Verify local media upload validation, participant-only attachment access, and media message compatibility.
- Verify voice recorder UI behavior with browser-native `MediaRecorder` and graceful fallback.
- Verify profile updates and avatar rendering.
- Verify pinned, archived, and muted chat settings.
- Verify browser notification permission UI and muted-chat suppression logic.
- Verify message search is scoped to authorized conversations.
- Verify group owner/admin/member authorization and invite/join approval flows.
- Verify disappearing messages are filtered and cleaned up locally.
- Verify blocked users cannot send direct messages to blockers.
- Verify reports are stored locally and admin-protected.
- Verify locked chats require account password or local PIN.
- Verify encrypted demo messages store ciphertext and render client demo state.
- Verify privacy settings UI and read-receipt preference behavior.
- Verify Docker Compose keeps MongoDB, Redis, and uploads local.

## 3. Test Tools

| Tool | Layer | Purpose |
| --- | --- | --- |
| Jest | Backend and frontend | Test runner and assertions. |
| Supertest | Backend | HTTP endpoint integration tests. |
| mongodb-memory-server | Backend | Isolated MongoDB test database. |
| socket.io-client | Backend integration | Socket connection and event tests. |
| React Testing Library | Frontend | Component behavior tests from a user perspective. |
| Docker Compose | Deployment | Local service orchestration verification. |

## 4. Test Environments

| Environment | Description |
| --- | --- |
| Local unit/integration | Node.js process, Jest, in-memory MongoDB, local/test Redis behavior, and temporary upload directory. |
| Local Docker | Nginx client, API server, MongoDB, Redis, and `server-uploads` volume through Docker Compose. |
| Production-like | Docker Compose production override with environment-provided MongoDB/Redis and optional Azure only if enabled. |

## 5. Coverage Goals

| Area | Target |
| --- | --- |
| Backend statements | 80% or higher. |
| Backend lines | 80% or higher. |
| Auth, authorization, media, and settings | Critical success/failure paths covered. |
| Socket handlers | Valid and invalid event paths covered. |
| Frontend core chat components | Render, interaction, and fallback states covered. |

## 6. Test Categories

| Category | Scope |
| --- | --- |
| API integration tests | Auth, users, privacy, block/report, attachments, conversations, settings, search, rooms/groups, and history. |
| Socket integration tests | Authenticated connection, room chat, group admin events, direct messages, receipts, reactions, edits, deletes, and settings/profile/privacy events. |
| Component tests | Login, sidebar, direct chat window, group details modal, privacy modal, message bubble, profile modal, and preserved room chat. |
| Storage tests | Allowed upload, rejected dangerous upload, and participant-only file access. |
| Browser API tests | Notification permission UI and MediaRecorder fallback/mocked behavior. |
| Deployment smoke tests | Container health checks, local upload volume, and environment variable validation. |

## 7. Test Case Catalog

| ID | Category | Description | Expected Output | Status |
| --- | --- | --- | --- | --- |
| AUTH-001 | API | Register with valid input. | `201`, JWT, sanitized user | Passed |
| AUTH-002 | API | Register/login rejects invalid or duplicate credentials. | Safe `400`/`401`/`409` responses | Passed |
| AUTH-003 | API | Logout blacklists token. | Later protected request rejected | Passed |
| ROOM-001 | API | Create/list/access rooms. | Authorized room payloads | Passed |
| ROOM-002 | API | Deny private room to non-member. | `403` authorization response | Passed |
| ROOM-003 | API | Retrieve cursor-paginated room history. | Chronological page and next cursor | Passed |
| ROOM-004 | Socket | Join room, send message, typing indicator. | Live events emitted to authorized sockets | Passed |
| DIRECT-001 | API | Create direct conversation. | `201`, direct conversation summary | Passed v2.0.0 |
| DIRECT-002 | API | Prevent duplicate direct conversation. | Existing conversation returned; one DB record | Passed v2.0.0 |
| DIRECT-003 | API | List conversations. | Participant info, preview, timestamp, unread count | Passed v2.0.0 |
| DIRECT-004 | Socket | Send direct message. | Persists and emits `direct_message:new` | Passed v2.0.0 |
| DIRECT-005 | API/Socket | Mark messages as read. | Unread count clears; status becomes read | Passed v2.0.0 |
| DIRECT-006 | Socket | Update reaction. | One reaction per user; aggregate broadcast | Passed v2.0.0 |
| DIRECT-007 | Socket | Edit/delete authorization. | Non-sender rejected; sender succeeds | Passed v2.0.0 |
| MEDIA-001 | API | Upload allowed local file. | `201`, attachment metadata, local file saved | Passed v2.5.0 |
| MEDIA-002 | API | Reject dangerous/disallowed file. | `400` validation response | Passed v2.5.0 |
| MEDIA-003 | API | Block attachment access for non-participant. | `403` authorization response | Passed v2.5.0 |
| MEDIA-004 | Socket/API | Send media direct message. | Message type is image/video/file/audio and includes attachment | Passed v2.5.0 |
| PROFILE-001 | API | Update display name, about, avatar. | Sanitized user includes avatar URL | Passed v2.5.0 |
| SETTINGS-001 | API | Pin/archive/mute conversation. | Conversation summary includes updated settings | Passed v2.5.0 |
| SEARCH-001 | API | Search authorized conversation. | Matching text messages returned | Passed v2.5.0 |
| SEARCH-002 | API | Search unauthorized conversation. | `403` authorization response | Passed v2.5.0 |
| GROUP-001 | API | Group admin authorization. | Non-admin rejected; admin succeeds | Passed v3.0.0 |
| GROUP-002 | API | Add/remove/promote/demote group members. | Member/admin arrays update correctly | Passed v3.0.0 |
| GROUP-003 | API | Invite link and join approval flow. | Token joins or creates request; admin resolves | Passed v3.0.0 |
| EXPIRE-001 | API/Worker | Disappearing message expiry filtering. | Expired messages hidden from history | Passed v3.0.0 |
| BLOCK-001 | Socket/API | Block user prevents direct message. | Blocked sender receives error | Passed v3.0.0 |
| REPORT-001 | API | Store local report and list as admin. | Report persisted; non-admin cannot list | Passed v3.0.0 |
| LOCK-001 | API | Locked chat PIN/password flow. | History blocked until unlock succeeds | Passed v3.0.0 |
| ENCRYPT-001 | Socket/API | Encrypted direct message stores ciphertext. | DB content is ciphertext with metadata | Passed v3.0.0 |
| UI-001 | Frontend | Login page renders and shows auth errors. | Email/password fields and readable error | Passed |
| UI-002 | Frontend | Conversation list renders. | Avatar, preview, timestamp, unread badge | Passed v2.0.0 |
| UI-003 | Frontend | Direct chat opens and optimistic sending state renders. | Header/messages and sending indicator | Passed v2.0.0 |
| UI-004 | Frontend | Reply preview and reaction UI. | Reply target and reaction handler invoked | Passed v2.0.0 |
| UI-005 | Frontend | Attachment picker preview and media upload. | Preview displayed; upload helper and send invoked | Passed v2.5.0 |
| UI-006 | Frontend | Voice recorder fallback/mocked behavior. | Fallback message when `MediaRecorder` unavailable | Passed v2.5.0 |
| UI-007 | Frontend | Notification permission control. | Permission callback invoked from sidebar | Passed v2.5.0 |
| UI-008 | Frontend | Profile avatar rendering and save. | Avatar image shown; save payload includes file | Passed v2.5.0 |
| UI-009 | Frontend | Pinned/muted/archive behavior. | Settings callbacks and archived grouping work | Passed v2.5.0 |
| UI-010 | Frontend | Room chat remains accessible. | Existing room components still pass | Passed |
| UI-011 | Frontend | Group details/admin UI. | Group settings and members render; save payload sent | Passed v3.0.0 |
| UI-012 | Frontend | Disappearing message setting UI. | Direct-chat mode control invokes update callback | Passed v3.0.0 |
| UI-013 | Frontend | Block/report UI. | Direct-chat buttons invoke block/report callbacks | Passed v3.0.0 |
| UI-014 | Frontend | Locked chat unlock UI. | Messages hidden until unlock callback is used | Passed v3.0.0 |
| UI-015 | Frontend | Encrypted conversation warning/state. | Demo warning appears and ciphertext send path is used | Passed v3.0.0 |
| UI-016 | Frontend | Privacy settings modal. | Visibility/read-receipt payload saved | Passed v3.0.0 |
| BUILD-001 | Frontend build | Compile React client for production. | Vite emits optimized assets | Required each release |
| DEPLOY-001 | Deployment | Validate Docker Compose model. | Config resolves without errors | Required each release |
| DEPLOY-002 | Deployment | Start full local stack. | Client, server, MongoDB, Redis healthy | Required each release |

## 8. Test Data Strategy

- Use unique emails and usernames per test.
- Use deterministic room names for integration tests.
- Use isolated MongoDB databases for test runs.
- Use temporary local upload directories in media tests.
- Clear MongoDB collections, Redis state, and test uploads between tests.
- Use small Buffer payloads for upload tests to avoid large repository artifacts.

## 9. Acceptance Verification Commands

```bash
cd server
npm test -- --runInBand

cd ../client
npm test -- --watchAll=false
npm run build
```

Optional Docker smoke:

```bash
docker compose config --quiet
docker compose up --build --detach
```

Then verify:

- `http://localhost:3000` loads.
- `http://localhost:5000/api/health` returns `status: "ok"`.
- Register/login works.
- User search starts a direct chat.
- Text, image/file/video/audio, and voice note sends work.
- Read receipts, reply, reaction, edit, delete, search, pin/archive/mute, privacy settings, locked chat, encrypted demo, block/report, and notifications work.
- Group admin/member management, invite links, join approval, admins-only send mode, and disappearing modes work.
- Rooms remain accessible from the Rooms tab.

## 10. Current Verification Summary

Latest local verification during v3.0.0 implementation:

| Suite | Result |
| --- | --- |
| Server Jest/Supertest/Socket.io/config tests | 61 tests passed across 10 suites, 80.59% statements and 80.25% lines |
| Client React Testing Library tests | 25 tests passed across 8 suites |
| Client production build | Passed with Vite optimized bundle |

Client production build and Docker smoke should be rerun after documentation/version updates before final release tagging.

## 11. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Upload path traversal or unsafe file types | Sanitize names, generate stored filenames, reject dangerous extensions/MIME types, and hide absolute paths. |
| Unauthorized media download | Authorize every attachment content request against conversation membership. |
| Browser API variability | Provide Notification permission checks and MediaRecorder fallback UI. |
| Flaky socket timing tests | Use acknowledgements, promises, and deterministic timeouts. |
| Redis state leaking between tests | Clear test-owned cache/presence state. |
| Frontend tests coupled to styling | Assert semantic UI behavior and accessible controls first. |
| Optional Azure dependency instability | Keep no-op default and mock/skip external queues in automated tests. |
| Encryption demo mistaken for production E2EE | Document localStorage key storage and missing Signal-style key exchange in README and privacy docs. |
| Locked chats treated as device security | Document as web-app-level privacy only; require password/PIN server validation for history access. |
