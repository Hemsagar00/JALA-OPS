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
- **Milestone 4 (Day 4 — Pump Operations) — COMPLETE & VERIFIED**:
  - Implemented migration `0002_pump_operations.sql` creating `sop_templates`, `sop_items`, `pump_operations` (with partial unique index `idx_pump_active_operation` on `ACTIVE` operations), `sop_responses`, and default SOP seeds.
  - Implemented Start Pump API (`POST /api/operations/start`): verifies station authorization, prevents start if pump is RUNNING/BREAKDOWN/MAINTENANCE, validates required SOP items, enforces numeric meter readings, handles idempotent retry by `client_uuid`, updates pump status to `RUNNING`, and records audit log.
  - Implemented Stop Pump API (`POST /api/operations/stop`): verifies pump is currently `RUNNING` with an active start operation, enforces closing meter readings $\ge$ opening readings, enforces stop SOP checklist, performs authoritative calculations, transitions pump status to `STOPPED`, records audit log.
  - Authoritative backend calculations:
    - `running_duration_seconds = stopped_at - started_at`
    - `water_pumped = closing_flow_meter - opening_flow_meter`
    - `energy_used_kwh = closing_energy_meter - opening_energy_meter`
    - `energy_per_unit = energy_used_kwh / water_pumped` (when `water_pumped > 0`, else `null`)
  - Operational endpoints: `GET /api/operations` (with station, pump, status, and date filters), `GET /api/operations/:id` (with SOP responses), `GET /api/pumps/:id/active-operation`, and `GET /api/sop/templates`.
  - Mobile Start Pump 2-step workflow (`apps/mobile/src/app/actions/start-pump.tsx`): Step 1 SOP safety checklist, Step 2 opening meter readings with confirmation modal and live pump refresh.
  - Mobile Stop Pump workflow (`apps/mobile/src/app/actions/stop-pump.tsx`): lists running pumps, shows live elapsed duration, requires closing readings, stop checklist, shutdown reason, live calculation preview, and updates status to `STOPPED`.
  - 65 automated tests across 6 test suites (100% pass); zero lint errors; all workspaces build and typecheck cleanly.
- **Meter Unit Assumptions (Permanent Decision)**:
  - Flow meter values are assumed to represent cubic meters ($m^3$, equivalent to kiloliters $kL$). Raw meter reading difference (`closing_flow_meter - opening_flow_meter`) represents water pumped volume in $m^3$.
  - Energy meter values are assumed to represent kilowatt-hours ($kWh$). Raw meter reading difference (`closing_energy_meter - opening_energy_meter`) represents electrical energy consumption in $kWh$.
  - Specific energy consumption is expressed in $kWh/m^3$. If water pumped is 0, specific energy is safely stored and returned as `null`.
- **Next Milestone**: Milestone 5 (Day 5 — Readings). Offline sync queue, reading forms, GPS geolocation, and photo capture.
