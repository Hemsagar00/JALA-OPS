# JALA-OPS — Project Memory

## Identity

- Project: JALA-OPS
- Meaning: Pumping & Water Operations Monitoring System
- District: Sri Sathya Sai District, Andhra Pradesh
- Delivery target: 10-day MVP
- Pilot budget: ₹0–₹3,000
- Brand: navy + white + orange
- District logo remains unchanged

## Product

Two clients, one backend:

1. Android-first app for operators/technicians.
2. Web dashboard for officers and Collector.

## Preferred stack

- Mobile: React Native + Expo + TypeScript
- Web: React + Vite + TypeScript + Tailwind + shadcn/ui
- API: Cloudflare Workers
- DB: Cloudflare D1
- Photos: Cloudflare R2
- Schedules: Cloudflare Cron
- Hosting: Cloudflare Pages

## MVP priorities

Auth, Stations, Pumps, Start/Stop, Readings, Offline Queue, Breakdowns, Water Balance, Alerts, Executive Dashboard, Reports, Audit Trail.

## Deferred

AI, ML, SCADA, IoT, paid SMS, WhatsApp API, advanced GIS, advanced water quality, complex asset analytics.

## Design decisions

- Mobile must be simpler than the Stitch long-screen designs.
- Collector dashboard is exception-driven.
- Alerts use Active/Resolved tabs rather than duplicate screens.
- Breakdown detail uses Overview/Timeline/Repair/Evidence.
- Station detail uses tabs instead of one giant page.
- Water Balance is a core module.
- Full GIS is Phase II; MVP uses a schematic network.

## Priority rule

Reliability > animation
Clarity > decoration
Working workflow > mock UI
Simple architecture > unnecessary complexity

## Milestone Progress

- **Milestone 1 (Day 1 — Foundation)**: Completed and verified.
  - Monorepo structure configured with npm workspaces.
  - Cloudflare Workers, D1 local database, and R2 local photo bucket bindings configured.
  - Initial foundation migration (`0001_foundation.sql`) with 8 tables and immutable audit logs.
  - Synthetic development seed (`development.sql`) with 5 stations, 10 pumps, demo users.
  - Shared `@jala-ops/constants`, `@jala-ops/types`, `@jala-ops/validation`, `@jala-ops/api-client`.
  - Scrypt password hashing & session management foundation in place.
  - Mobile Expo SDK 57 & Vite web applications with connection health verification screens.
  - 17 unit/integration tests passing; zero lint errors; all workspaces build and typecheck cleanly.
- **Milestone 2 — COMPLETE & VERIFIED**:
  - Implemented `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/roles`.
  - Passwords hashed with `scrypt` with 16-byte individual random salts and constant-time verification.
  - Sessions issued with 8-hour TTL, hashed with SHA-256 before storage in D1, revocable via `/api/auth/logout`.
  - Web client uses HttpOnly, Secure, SameSite=Strict `__Host-jala_session` cookie; mobile uses Bearer token with `expo-secure-store`.
  - Implemented user administration: `GET/POST /api/users`, `GET/PATCH /api/users/:id` with strict role validation and password presence checks on user activation.
  - Implemented station assignments: `GET/POST /api/users/:id/assignments`, `DELETE /api/users/:id/assignments/:stationId`.
  - Implemented station master (`GET/POST /api/stations`, `GET/PATCH /api/stations/:id`) and pump master (`GET/POST /api/pumps`, `GET/PATCH /api/pumps/:id`, `GET /api/stations/:id/pumps`) with optimistic versioning.
  - All mutations write immutable audit records to `audit_logs`.
  - Built mobile login screen with Sri Sathya Sai District branding, secure token storage, and session restore.
  - Built web login interface with session restore, role badges, and logout flow.
  - 32 automated tests in 4 suites (100% pass); zero lint errors; all 7 workspaces build and typecheck cleanly.
- **Milestone 3 — COMPLETE & VERIFIED**:
  - Implemented Expo Router bottom tab navigation across 5 stable tabs: Home, Readings, Breakdowns, Tasks, Profile.
  - Implemented `SessionProvider` & `useSession()` wrapping session restoration from hardware-backed `Expo SecureStore`, user profile identity, assigned stations, and real-time pumps.
  - Built Operator Home screen with Sri Sathya Sai District branding, shift calculation (Morning/Evening/Night), active station switcher, today's summary metrics, live pump status cards, and 6 touch-friendly field operation cards.
  - Reusable `SyncStatusBadge` component supporting all 6 states: `ONLINE`, `OFFLINE`, `SYNCING`, `PENDING`, `SYNCED`, `ERROR`.
  - Reusable `EmptyState` component covering no station assigned, no pumps, expired session, server unavailable, offline, unauthorized, and empty modules.
  - Stable route placeholders for upcoming operational workflows (`actions/[action].tsx`).
  - 43 automated tests across 5 suites (100% pass); zero lint errors; all workspaces build and typecheck cleanly.
- **Milestone 4 (Day 4 — Pump Operations)**: Next milestone.
  - Start/Stop Pump operational workflow.
  - Standard Operating Procedure (SOP) checklist.
  - Runtime, water, and energy calculations.
