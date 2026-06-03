<!-- Purpose: Optional Playwright E2E testing guide for ChatterBox v4.0.0. -->

# E2E Testing

ChatterBox v4.0.0 adds optional Playwright E2E tests under `client/e2e`.

## Covered Flows

- register/login
- start direct chat and send a message
- create a public group room

These tests are designed for a running local app and use unique users per run.

## Setup

Install dependencies:

```bash
cd client
npm install
npx playwright install chromium
```

Start the local stack:

```bash
docker compose up --build
```

Run E2E tests:

```bash
cd client
npm run test:e2e
```

Override the base URL if needed:

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## CI

The E2E suite is intentionally optional because browser installation and full-stack startup add CI time. GitHub Actions can run it on demand or nightly using public repository free minutes.
