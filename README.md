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
