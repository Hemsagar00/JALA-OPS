# JALA-OPS

Pumping & Water Operations Monitoring System for Sri Sathya Sai District, Andhra Pradesh.

JALA-OPS will provide an Android-first field app and a web monitoring dashboard backed by a shared API and database.

## Repository structure

```text
JALA-OPS/
|-- docs/
|   |-- PRD.md
|   |-- ARCHITECTURE.md
|   |-- RULES.md
|   |-- DESIGN.md
|   |-- TASKS.md
|   `-- MEMORY.md
|-- apps/
|   |-- mobile/
|   `-- web/
|-- workers/
|   `-- api/
|-- packages/
|   |-- types/
|   |-- validation/
|   |-- constants/
|   `-- api-client/
|-- database/
|   |-- migrations/
|   `-- seed/
|-- assets/
|   |-- logo/
|   `-- references/
|-- AGENTS.md
|-- README.md
`-- .gitignore
```

Empty directories contain `.gitkeep` files so they are included in Git.

## Planned stack

- Mobile: React Native, Expo, TypeScript, Expo Router, and SQLite for offline storage.
- Web: React, Vite, TypeScript, Tailwind CSS, and shadcn/ui.
- Backend: Cloudflare Workers, D1, R2, and Cron Triggers.
- Shared packages: types, validation, constants, and an API client.

## Project documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Engineering rules](docs/RULES.md)
- [Design](docs/DESIGN.md)
- [Task plan](docs/TASKS.md)
- [Project memory](docs/MEMORY.md)

## Development status

- **Milestone 1 — Foundation (COMPLETE & VERIFIED)**: Monorepo workspaces, Cloudflare Worker API with D1 & R2 local bindings, database migration `0001_foundation.sql`, seed fixtures, shared TypeScript packages (`constants`, `types`, `validation`, `api-client`).
- **Milestone 2 — Authentication & Master Data (COMPLETE & VERIFIED)**:
  - Authentication API (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/roles`).
  - Scrypt password hashing, 8-hour D1 sessions, HttpOnly cookies for web, Bearer tokens for mobile.
  - Server-side authorization helpers enforcing strict role-based access.
  - User administration (`/api/users`) and station assignments (`/api/users/:id/assignments`).
  - Station Master (`/api/stations`) and Pump Master (`/api/pumps`) with optimistic versioning and immutable audit logging.
  - Mobile login flow with Sri Sathya Sai District branding and Expo SecureStore session persistence.
  - Web dashboard login interface with session restore and role overview.
  - 32 automated tests passing with zero lint or type errors.
- **Milestone 3 — Mobile Shell & Operator Home (COMPLETE & VERIFIED)**:
  - Expo Router 5-tab bottom navigation (`Home`, `Readings`, `Breakdowns`, `Tasks`, `Profile`).
  - `SessionProvider` & hardware-backed `Expo SecureStore` session restoration, role identity, and station assignments.
  - Operator Home screen with official Sri Sathya Sai District branding, shift calculation (Morning/Evening/Night), station switcher, today's summary metrics, live pump cards, and 6 touch-friendly field operation cards.
  - Reusable `SyncStatusBadge` component supporting all 6 states (`ONLINE`, `OFFLINE`, `SYNCING`, `PENDING`, `SYNCED`, `ERROR`).
  - Reusable `EmptyState` component for no-station, no-pumps, expired session, offline, and empty modules.
  - 43 automated tests passing with zero lint or type errors across all workspaces.
- **Milestone 4 — Pump Operations (COMPLETE & VERIFIED)**:
  - Migration `0002_pump_operations.sql` adding `pump_operations`, `sop_templates`, `sop_items`, `sop_responses`, with default Start/Stop checklists.
  - Start Pump API (`POST /api/operations/start`): checks station access, enforces idle status, verifies required SOP checklist, prevents duplicate `client_uuid`, transitions pump to `RUNNING`, and records audit trail.
  - Stop Pump API (`POST /api/operations/stop`): verifies active operation, validates closing meter $\ge$ opening meter, enforces stop checklist, calculates runtime, water pumped ($m^3$), energy used ($kWh$), specific energy ($kWh/m^3$), transitions pump to `STOPPED`, and records audit trail.
  - Endpoints: `GET /api/operations`, `GET /api/operations/:id`, `GET /api/pumps/:id/active-operation`, and `GET /api/sop/templates`.
  - Mobile Start Pump 2-step workflow (`apps/mobile/src/app/actions/start-pump.tsx`) with safety checklist, opening readings, and confirmation preview.
  - Mobile Stop Pump workflow (`apps/mobile/src/app/actions/stop-pump.tsx`) with active running context, closing readings, calculation preview, and immediate pump card refresh.
  - 65 automated tests passing (100%) with zero lint or type errors across all workspaces.
- **Milestone 5 — Readings, GPS, Photo & Offline Sync (COMPLETE & VERIFIED)**:
  - Migration `0003_station_readings.sql` creating `station_readings` table with GPS status, source type, sync source, and indexes.
  - Photo upload pipeline (`POST /api/photos`, `GET /api/photos/:key`) backed by Cloudflare R2 (`PHOTOS`), validating MIME type (JPEG/PNG), size (max 10MB), and generating deterministic keys `readings/{station_id}/{YYYY}/{MM}/{uuid}.{ext}`.
  - Station Readings API (`POST /api/readings`, `GET /api/readings`, `GET /api/readings/:id`) with strict station authorization, pump consistency validation, idempotent replay via `client_uuid`, and immutable audit logs.
  - Mobile offline SQLite queue (`offline_queue`) using `expo-sqlite` with automatic fallback for web/test environments.
  - Resilient mobile sync engine (`apps/mobile/src/lib/sync-engine.ts`) with sequential queue processing, photo-first upload pipeline, network connectivity auto-trigger, foreground resume, and retry backoff.
  - Mobile reading form (`apps/mobile/src/app/actions/enter-reading.tsx`) with station switcher, optional pump selector, non-blocking GPS (`expo-location`), camera/gallery photo capture (`expo-image-picker`), and numeric keypads.
  - Mobile readings history screen (`apps/mobile/src/app/(tabs)/readings.tsx`) merging server readings with pending offline queue items, status badges, and manual sync CTA.
  - 92 automated tests passing (100%) with zero lint or type errors across all workspaces.

## Development commands

```bash
# Run type checks across all workspaces
npm run typecheck

# Run linter
npm run lint

# Check formatting
npm run format:check

# Run automated tests
npm test

# Build production bundles
npm run build
```
