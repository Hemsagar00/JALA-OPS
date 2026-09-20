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
- **Milestone 2 (Day 2 — Auth & Masters)**: In progress.
  - Login endpoint (`POST /api/auth/login`) and session creation.
  - Logout endpoint (`POST /api/auth/logout`) and revocation.
  - User and station assignment administration.
  - Station master and Pump master management endpoints.

