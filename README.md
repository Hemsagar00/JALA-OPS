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

This repository currently contains documentation and the initial directory structure. Application scaffolding, dependency manifests, and runnable development commands will be added during implementation.
