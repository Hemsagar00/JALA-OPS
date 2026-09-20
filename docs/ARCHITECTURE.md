# JALA-OPS — Architecture

```text
Android App ─┐
             ├── HTTPS API ── Cloudflare Workers ── D1
Web Dashboard┘                         ├───────────── R2
                                      └───────────── Cron Triggers
```

## Monorepo
```text
jala-ops/
├── apps/mobile/
├── apps/web/
├── workers/api/
├── packages/types/
├── packages/validation/
├── packages/constants/
├── packages/api-client/
├── database/migrations/
├── database/seed/
├── docs/
└── README.md
```

## Stack
### Mobile
React Native, Expo, TypeScript, Expo Router, TanStack Query, Expo SQLite, Expo Location, Expo Camera/Image Picker.

### Web
React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts.

### Backend
Cloudflare Workers, D1, R2, Cron Triggers, Pages.

## Main tables
users, roles, user_station_assignments, stations, pumps, equipment, pump_operations, station_readings, water_transfers, breakdowns, breakdown_events, maintenance_records, manpower_logs, alerts, sop_templates, sop_items, sop_responses, audit_logs, daily_station_summaries.

## API groups
`/api/auth/*`, `/api/stations/*`, `/api/pumps/*`, `/api/readings/*`, `/api/breakdowns/*`, `/api/water-transfers/*`, `/api/maintenance/*`, `/api/manpower/*`, `/api/alerts/*`, `/api/reports/*`.

## Offline model
Each mobile write uses a `client_uuid`. Offline items are stored locally as `PENDING_SYNC`; after connectivity returns they are retried. Server uses `client_uuid` for idempotency to prevent duplicates.

## Security
Server-side authorization, secure password hashing, expiring tokens, Zod validation, rate limits, upload validation, environment secrets, audit logging, no privileged keys in frontend.

## Future integration
Each reading has `source_type`: MANUAL, SENSOR, SCADA, API.
