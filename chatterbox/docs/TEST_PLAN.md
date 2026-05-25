<!-- Purpose: Test strategy and test-case catalog for ChatterBox. -->

# Test Plan

## 1. Purpose

This test plan defines how ChatterBox is validated across backend APIs, real-time Socket.io workflows, React components, integration behavior, runtime configuration, and deployment readiness. Final verification results were recorded in Sprint 6.

## 2. Test Objectives

- Verify authentication and authorization behavior.
- Verify data validation and safe error responses.
- Verify room membership and message persistence rules.
- Verify Socket.io real-time delivery, typing indicators, and presence events.
- Verify Redis cache behavior for message history and token blacklist.
- Verify frontend auth and chat components render correct states.
- Verify Docker-based local deployment can start all required services.

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
| Local unit/integration | Node.js process, Jest, in-memory MongoDB, mocked or test Redis where appropriate. |
| Local Docker | Nginx client, API server, MongoDB, and Redis through Docker Compose. |
| Production-like | Docker Compose production override with environment-provided MongoDB, Redis, and Azure Service Bus. |

## 5. Coverage Goals

| Area | Target |
| --- | --- |
| Backend statements | 80% or higher by Sprint 5. |
| Backend auth controllers and middleware | Critical branches covered. |
| Socket event handlers | Valid and invalid event paths covered. |
| Frontend core chat components | Render, interaction, and error states covered. |

## 6. Test Categories

| Category | Scope |
| --- | --- |
| Unit tests | Validators, utilities, formatting helpers, error classes. |
| API integration tests | Auth, user, room, and message routes with database interactions. |
| Socket integration tests | Authenticated connection, room join, message send/receive, typing indicators. |
| Component tests | Login, registration, sidebar, chat window, and message bubble rendering. |
| Deployment smoke tests | Container health checks and environment variable validation. |

## 7. Initial Test Cases

| ID | Category | Description | Input | Expected Output | Status |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | API | Register with valid input. | username, email, strong password | `201`, JWT, sanitized user | Passed Sprint 2 |
| AUTH-002 | API | Register with duplicate email. | existing email | `409` conflict response | Passed Sprint 2 |
| AUTH-003 | API | Register with invalid email. | malformed email | `400` validation response | Passed Sprint 5 |
| AUTH-004 | API | Login with valid credentials. | email and password | `200`, JWT, user | Passed Sprint 2 |
| AUTH-005 | API | Login with wrong password. | email and invalid password | `401` safe auth error | Passed Sprint 2 |
| AUTH-006 | API | Access protected route without token. | no auth header | `401` response | Passed Sprint 2 |
| AUTH-007 | API | Access protected route with malformed token. | invalid token | `401` response | Passed Sprint 5 |
| AUTH-008 | API | Logout blacklists token. | valid JWT | token rejected on later protected request | Passed Sprint 2 |
| ROOM-001 | API | Create public room. | name and type | `201`, room payload | Passed Sprint 3 |
| ROOM-002 | API | Get visible rooms. | authenticated request | list of accessible rooms | Passed Sprint 3 |
| ROOM-003 | API | Add member to private room. | room ID and user ID | updated member list | Passed Sprint 3 |
| ROOM-005 | API | Deny private room to non-member. | private room ID and visitor JWT | `403` authorization response | Passed Sprint 3 |
| ROOM-004 | API | Access invalid room ID. | malformed ObjectId | `400` response | Passed Sprint 5 |
| MSG-001 | API | Retrieve cursor-paginated message history. | room ID, limit, before cursor | chronological pages and cursor metadata | Passed Sprint 5 |
| MSG-002 | Integration | Cache hit for recent messages. | Redis list exists | messages returned from cache | Passed Sprint 5 |
| MSG-003 | Integration | Cache miss fallback. | empty Redis list | MongoDB query and cache warm | Passed Sprint 5 |
| MSG-004 | Integration | Invalidate room cache after membership update. | add private member | cached room history removed | Passed Sprint 5 |
| SOCK-001 | Socket | Connect with valid token. | JWT handshake | socket connects and user online event emits | Passed Sprint 3 |
| SOCK-002 | Socket | Connect with invalid token. | bad JWT | connection rejected | Passed Sprint 3 |
| SOCK-003 | Socket | Join room as member. | room ID | socket joins and history emits | Passed Sprint 3 |
| SOCK-004 | Socket | Send valid message. | room ID and content | message persists and emits | Passed Sprint 3 |
| SOCK-005 | Socket | Send typing indicator. | room ID and typing state | other sockets receive indicator | Passed Sprint 3 |
| UI-001 | Frontend | Login page renders. | render route | email/password fields visible | Passed Sprint 5 |
| UI-002 | Frontend | Login authentication errors display. | rejected login submission | readable error message | Passed Sprint 5 |
| UI-003 | Frontend | Message bubble alignment and queued state. | own, other, queued messages | layout and delivery labels match state | Passed Sprint 5 |
| UI-004 | Frontend | Chat window renders and sends messages. | messages and drafted input | message, typing state, and submit action work | Passed Sprint 5 |
| UI-BUILD-001 | Frontend build | Compile React client for production. | `npm run build` | Vite emits optimized production assets | Passed Sprint 4 |
| CFG-001 | Backend unit | Parse and validate centralized runtime configuration. | test and production environment snapshots | parsed settings and rejected missing production requirements | Passed Sprint 6 |
| DEPLOY-001 | Deployment | Validate base and production Compose models. | `docker compose ... config --quiet` | configurations resolve without errors | Passed Sprint 6 |
| DEPLOY-002 | Deployment | Build production images and start full stack. | `docker compose build`, `docker compose up --detach` | client, server, MongoDB, Redis healthy | Passed Sprint 6 |
| DEPLOY-003 | Deployment | Query running service routes. | client `/`, API `/api/health` | UI HTTP `200`; API `status: "ok"` and dependencies `ready` | Passed Sprint 6 |

## 8. Test Data Strategy

- Use unique emails and usernames per test.
- Use deterministic room names for integration tests.
- Use isolated MongoDB databases for test runs.
- Use short JWT lifetimes in expired-token tests.
- Clear Redis keys between tests that touch cache or presence.

## 9. Exit Criteria

Testing is acceptable for the final portfolio release when:

- All required Jest suites pass locally.
- Backend coverage is 80% or higher.
- Critical auth and socket failure paths are covered.
- No unhandled promise rejections occur during tests.
- Docker health checks pass in the final compose setup.

## 10. Final Coverage and Verification Summary

| Suite | Result | Coverage status |
| --- | --- | --- |
| Server Jest/Supertest/Socket.io/config tests | 34 tests passed across 7 suites | 80.82% statements and 80.53% lines; enforced at 80% global threshold |
| Client React Testing Library tests | 8 tests passed across 3 suites | Core login, message bubble, and chat window behaviors verified |
| Client Vite production build | Build passed | Optimized Nginx-ready static assets generated |
| Docker deployment smoke test | Four containers healthy | Client HTTP `200`; API reports MongoDB and Redis `ready` |

The server coverage run includes auth, users, rooms, cursor-based message history, cache behavior, sockets, Mongo connection retry, Azure Service Bus behavior, and production configuration validation. Frontend hook and provider coverage can expand as offline delivery workflows mature.

Full dependency audits for both `server/` and `client/` reported zero vulnerabilities during Sprint 5 verification; Sprint 6 did not change package dependencies.

## 11. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Flaky socket timing tests | Use explicit acknowledgements, promises, and deterministic timeouts. |
| External Azure dependency instability | Mock Service Bus in automated tests and run manual integration with real credentials. |
| Redis state leaking between tests | Prefix test keys and flush/purge only test-owned keys. |
| Frontend tests coupled to styling | Assert semantic UI behavior first and styling classes only for important layout distinctions. |
