# JALA-OPS architecture review — 20 September 2026

Authority: AGENTS.md, followed by PRD, ARCHITECTURE, RULES, DESIGN, TASKS, MEMORY in that order. The six approved documents were read in full. This review elaborates their implementation; it does not expand product scope. The repository initially contained documentation, skills and empty application directories. No application, database, authentication or deployment existed.

## 1. Final monorepo structure

```text
jala-ops/
  docs/                         Approved specification, review and validation records
  apps/mobile/
    src/app/                    Expo Router route files only
    src/screens/                Screen implementations
    src/components/             Reusable native components as needed
    src/lib/                    API/session/offline adapters as implemented
    app.json
  apps/web/
    src/                        Vite React application
    src/components/             Web components as needed
    src/features/               Approved dashboard modules as implemented
  workers/api/
    src/auth/                   Password/session/authorization helpers
    src/                        Fetch router, domain services and repositories
    tests/                      Worker/D1/R2 integration tests
    wrangler.jsonc
  packages/{types,validation,constants,api-client}/src/
  database/{migrations,seed}/
  assets/{logo,references}/
  AGENTS.md
  README.md
  package.json
  package-lock.json
  tsconfig.base.json
  eslint.config.mjs
  .prettierrc.json
  .gitignore
```

Two clients call one HTTPS API. The Worker owns authorization, writes, calculations and timestamps. D1 stores relational data; private R2 stores photos. Cron invokes the same domain services. Pages hosts the Vite web build. No second backend in Expo, no separate microservices, and no additional infrastructure products.

## 2. Package/workspace strategy

- npm workspaces: `apps/*`, `workers/*`, `packages/*`; one root lockfile, Node 24, private `@jala-ops/*` package names.
- `constants`: approved role/status codes and brand tokens. `types`: shared transport contracts. `validation`: Zod schemas usable by both clients and authoritative on the server. `api-client`: fetch transport and response validation, with platform-specific credential storage kept in each app.
- Dependency direction: applications -> shared packages; API client -> validation/types; validation/types -> constants. Shared packages cannot import an app or Worker secrets.
- Shared packages export TypeScript source for Metro/Vite/Wrangler to compile; their build check is TypeScript validation. No package publishing or additional monorepo task framework.
- Expo SDK 57 is the version chosen by the official scaffold. Native dependencies are installed with `expo install`. React versions are aligned across clients. Pin resolved dependency versions in the lockfile and install with `npm ci`.
- Root checks cover all workspaces and test/config TypeScript; lint, formatting, tests, Android JS export, web production build and Worker dry-run bundle.

Expo explicitly supports npm workspaces: [monorepo guide](https://docs.expo.dev/guides/monorepos/). SDK compatibility was checked against [SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/).

## 3. D1 database schema

The complete MVP plan retains the 19 tables named in ARCHITECTURE.md. Only the foundation tables and required authentication/audit storage are implemented in Milestone 1.

| Table                    | Main fields and purpose                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| roles                    | Approved role code, human-readable name                                                                                                              |
| users                    | ID, case-insensitive unique username, name, password hash, role, active flag, timestamps                                                             |
| user_station_assignments | User/station composite key, assignment timestamp                                                                                                     |
| stations                 | ID, unique code, name, locality, active flag, demo marker; later approved operational target/schedule/threshold configuration                        |
| pumps                    | ID, station ID, unique code, name, rated kW, rated m³/h, status, active flag, concurrency version                                                    |
| equipment                | Station/pump association, equipment code/type, identity, maintenance context                                                                         |
| pump_operations          | Pump/operator, server start/stop times, opening/closing meters, runtime and derived deltas, request UUIDs                                            |
| station_readings         | Station/pump/author, capture and server-receipt times, flow/pressure/tank/energy values with explicit units, source_type, GPS accuracy, request UUID |
| water_transfers          | Sending/receiving station, accounting interval, sent/received volumes, explanation, responsible users and request UUID                               |
| breakdowns               | Station/pump/equipment, reporter, severity, status, assignee, report/repair/verify/close times                                                       |
| breakdown_events         | Breakdown, actor, event type, time, remarks and changes                                                                                              |
| maintenance_records      | Station/pump/equipment, assignee, due date, completion time, work performed and evidence                                                             |
| manpower_logs            | Station/user/date/shift, attendance and staffing values, capture/receipt times, request UUID                                                         |
| alerts                   | Type, station/entity, severity, deterministic deduplication key, active/resolved times and triggering evidence                                       |
| sop_templates            | Approved procedure name, version, applicable action/equipment                                                                                        |
| sop_items                | Template/version, ordered checklist item, required flag                                                                                              |
| sop_responses            | Operation/user/item, answer, answer timestamp and applicable template version                                                                        |
| audit_logs               | Actor, action, entity, request ID, server time, redacted before/after snapshots                                                                      |
| daily_station_summaries  | Station/local date, calculated target/pumped/delivered/difference/compliance totals, calculation time                                                |

Implementation-support storage is not a new product module: `sessions` stores hashed session tokens and expiry/revocation; later `sync_requests` stores idempotency keys, payload fingerprints and committed results; `attachments` stores private R2 object metadata and links to readings/breakdowns/maintenance. Meter-reset events need explicit old/new values, reason, actor and time before the operational migration is finalized.

Use text IDs, UTC timestamps, foreign keys, CHECK constraints, parameterized queries, and archive/active flags. Express operational dates in Asia/Kolkata. Choose canonical measurement units and meter precision before Day 4; never silently mix litres, m³, ML, kWh or pressure units. A zero sent-volume denominator produces an undefined percentage with an explanatory state, not division by zero.

## 4. Relationships and indexes

- Role 1:N users; users N:M stations through assignments; station 1:N pumps/equipment/readings/maintenance/manpower/summaries.
- Pump 1:N operations/readings/breakdowns; breakdown 1:N events/evidence. Transfers reference both sending and receiving stations. SOP template 1:N items; responses retain the procedure version used.
- Foundation uniqueness: role code, username, station code, pump code, `(user_id,station_id)` and token hash.
- Foundation indexes: users `(role_code,active)`, assignments `(station_id,user_id)`, pumps `(station_id,status)`, sessions by user/expiry, audit by entity/time and actor/time.
- Operational indexes: `(station_id,captured_at)`, `(pump_id,started_at)`, `(status,assignee_id)`, `(station_id,status,severity)`, transfers by station pair/period; unique summary `(station_id,local_date)`.
- A partial unique index permits only one open operation per pump. Conditional writes enforce start/stop transitions and version checks. Foreign keys restrict deletion of referenced records.
- Idempotency has a unique `(actor_id,client_uuid)` key and payload fingerprint: same request returns its previous result; reusing a key for another payload returns conflict. Effects, receipt and audit commit atomically.

Use prepared D1 statements and transactional batches; a failed statement rolls back its batch. [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## 5. Cloudflare Worker API routes

All operational endpoints require authentication, role and station checks. List endpoints will use bounded pagination/filtering. Responses expose transport fields, never password/session hashes.

| Group                    | Planned routes                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health                   | `GET /api/health` verifies schema availability                                                                                                        |
| Auth                     | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                                                                                   |
| Administration           | `/api/auth/users`, `/api/auth/roles`, user station assignments; controlled credential provisioning/reset                                              |
| Stations                 | `GET/POST /api/stations`, `GET/PATCH /api/stations/:id`, `GET /api/stations/:id/pumps`; station equipment/settings/SOP configuration under this group |
| Pumps                    | `GET/PATCH /api/pumps/:id`, `POST /api/pumps/:id/start`, `POST /api/pumps/:id/stop`, operations history and meter-reset records                       |
| Readings                 | `GET/POST /api/readings`, `GET /api/readings/:id`; validated corrections preserve audit history                                                       |
| Breakdowns               | `GET/POST /api/breakdowns`, detail/events, and explicit assign/repair/verify/close transition endpoints                                               |
| Water transfers          | `GET/POST /api/water-transfers`, detail and audited receipt/explanation updates                                                                       |
| Maintenance              | `GET/POST /api/maintenance`, detail and completion                                                                                                    |
| Manpower                 | `GET/POST /api/manpower`, scoped attendance/shift records                                                                                             |
| Alerts                   | `GET /api/alerts`, detail, active/resolved filters                                                                                                    |
| Reports                  | Overview, water balance, data compliance, daily operations, breakdowns, audit and export under `/api/reports/*`                                       |
| Existing-workflow photos | Upload/read endpoints scoped to the parent reading, breakdown or maintenance record                                                                   |

Milestone 1 exposes only health, authenticated identity, scoped station listing and station pumps to verify the foundation. No login, administration mutation, or operational workflow is exposed yet.

## 6. Authentication and role model

- No public registration. System Admin provisions accounts and assignments; initial account provisioning is an explicit administrative step, not a default password in source control.
- Scrypt password foundation uses independent random salts and a versioned encoding; constant-time verification. Benchmark login CPU limits in the target Cloudflare plan before opening login routes.
- Cryptographically random opaque sessions; only SHA-256 token hashes stored in D1. Eight-hour initial expiry, explicit revocation; current active-user and role checks on each request.
- Web: secure HttpOnly `__Host-jala_session` cookie on a same-origin API route, SameSite policy and Origin/CSRF protection on writes. Mobile: bearer session in Expo SecureStore; no tokens in SQLite, URLs or logs.
- System Admin manages accounts/masters. Collector has district-wide read access. Operators, technicians and engineering officers are restricted to explicit station assignments; write actions additionally require the appropriate role.
- Proposed workflow permissions for later confirmation: operators record pump/readings/attendance and report breakdowns; technicians record repairs/maintenance; assigned engineers assign/verify/close; Collector reads/reports. No generic role hierarchy grants every action automatically.
- Control Room is an audience but absent from the authoritative role list: do not introduce a ninth role or assign it administrator powers without a decision.
- Login rate limits, credential reset, session logout and browser CSRF enforcement belong to Milestone 2 before authentication is exposed.

## 7. Mobile screen map

Login -> assigned station. Bottom tabs remain **Home, Readings, Breakdowns, Tasks, Profile**.

- Home: station/shift/sync, pump state, Start/Stop/Reading/Breakdown actions, maintenance/attendance, today's summary. Pump detail -> start/stop SOP flows.
- Readings: station/pump history -> entry form; flow, inlet/outlet pressure, tank level and energy first; remarks/GPS/photo secondary.
- Breakdowns: list -> report -> detail with Overview/Timeline/Repair/Evidence. Show role-allowed actions.
- Tasks: assigned maintenance/tasks -> work detail/completion.
- Profile: identity, assignments, session/logout; sync queue details reachable from the persistent sync indicator.
- Alerts: Active/Resolved tabs, reachable from Home. Attendance is a short Home action.

Android-first 360–430px, scalable text, large targets, safe-area/keyboard handling, icon + text + color statuses, explicit pending/failure states. Apple HIG is used for accessibility and clarity, not iOS visual conventions on Android. Preserve the district logo without redesign once the authoritative asset is identified.

## 8. Web dashboard screen map

Login -> role-scoped dashboard with navigation to the ten approved modules:

1. Executive Overview: Water Today -> Pump Status -> Critical Alerts -> Network Status -> Water Loss/Deficit -> Breakdown Summary -> Data Compliance.
2. Pumping Stations: scoped list, status/filter/search.
3. Station Detail: tabs for overview, pumps/readings, breakdowns/maintenance and manpower.
4. Pump Detail: status, operations, readings and maintenance context.
5. Water Balance: sent/received/difference by station pair and interval; explanations and schematic network.
6. Breakdowns: queue, assignment, detail/timeline/repair/evidence/verification.
7. Alerts: Active/Resolved tabs.
8. Data Compliance: expected versus actual readings and missing periods.
9. Reports: daily operations, water balance, breakdown and audit reports/export.
10. Administration: users/roles/assignments, stations/pumps/equipment, approved SOP/threshold configuration.

No GIS expansion, fabricated production totals or dummy controls. Data must be useful within the PRD's five-second dashboard target; use aggregate queries and bounded polling, then measure.

## 9. Offline mobile sync

- SQLite caches assigned masters and stores an outbox with actor ID, UUID, operation type, captured time, payload, local photo paths, attempt count and last error. Keep it isolated per user.
- States: PENDING_SYNC -> SYNCING -> SYNCED, with RETRYABLE_ERROR and NEEDS_REVIEW. Recover abandoned SYNCING records after restart.
- Foreground/connectivity/manual retry with backoff and jitter. Do not promise Android background delivery. Maintain dependency order within an entity; upload evidence before evidence-dependent closure.
- Server rechecks authorization and current entity state. Transport retries reuse the UUID; validation/conflict errors stop automatic replay. An expired session pauses sync until the same user authenticates again. Never discard unsent work on logout or user switch.
- Append readings with capture/receipt times and late-sync indicators. Derive compliance and summaries consistently after late writes; do not silently rewrite history.
- Proposed default: start/stop requires a confirmed server response because RULES assigns timestamps to the server. If offline pump actions are required, their timing/reconciliation policy needs approval before Day 4. Do not replay a stale start command as a live start.

## 10. R2 photo design

Keep buckets private. A parent-scoped upload request checks user, station, parent record, accepted image type and size. Use server-generated object keys, validate actual image signatures, and store attachment ID, object key, content type, byte size, uploader and capture/receipt times in D1. Proposed pilot cap is 5 MiB per image, subject to field-image requirements.

For the small pilot, upload through the Worker binding; do not expose bucket credentials. Read through an authorized parent-scoped endpoint. Stage the object, commit validated metadata, then mark evidence complete. Retry safely by attachment UUID and reconcile orphaned uploads. A breakdown cannot close while required evidence is pending. Request camera/GPS permissions in context and handle denial explicitly.

Milestone 1 creates and verifies the binding only. [R2 Worker binding documentation](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/).

## 11. Cron/alert architecture

Day 7 adds a scheduled handler to the existing Worker. Proposed cadence: five-minute checks for missing readings, overdue maintenance, staffing and target conditions; daily summary computation keyed by station and Asia/Kolkata date. Cron schedules are UTC; convert business-day boundaries explicitly.

Evaluate immediate conditions after relevant writes: breakdown, transfer difference, abnormal pressure/tank and energy. Include repeated-breakdown logic once its window is agreed. Store triggering values and threshold configuration with each alert. Deduplicate by rule/entity/window, update an active occurrence rather than inserting repeated alerts, and resolve when the condition clears. Every run must be safely repeatable. Do not enable schedules before their handlers and threshold definitions exist.

[Cloudflare Cron documentation](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## 12. Audit-log design

Append-only audit records include actor (or system job), action, entity, server timestamp, request ID, and redacted before/after values. Never include passwords, bearer tokens, cookies or binary evidence. Link photos by attachment identifier.

For critical changes, execute domain mutation, idempotency receipt and audit insertion in the same D1 transaction. Database triggers prevent audit updates/deletes. Reports apply officer/admin authorization. Record credential/session events without storing credentials. Log errors with request IDs and safe codes so client failures can be traced without leaking data.

## 13. Deployment strategy

- Local: Wrangler with local D1/R2, Vite proxy, Expo with an explicitly configured reachable API address. Android emulator uses host address 10.0.2.2; a physical phone needs the computer's LAN address and a reachable development listener.
- Pilot: dedicated D1 database and private R2 bucket; environment-specific Worker bindings; exact allowed web origin and server secrets managed outside Git.
- Pages builds from repository root, outputs `apps/web/dist`. API gets a route on the same pilot hostname under `/api/*` so secure browser sessions are first-party. Do not rely on cross-site cookies between pages.dev and workers.dev domains.
- Deploy sequence: checks -> database backup/export -> compatible migration -> Worker -> Pages -> smoke tests. Keep rollback artifacts; avoid destructive schema changes. Synthetic seed is local-only and never automatically applied to production.
- Android: Expo Go during development and an installable signed APK before pilot release. JS export is a build check, not evidence that an APK has been built or tested on a device.
- Milestone 1 configures local project files and bindings; cloud resource provisioning requires a selected account, actual resource IDs and pilot hostname. No cloud deployment is claimed from local tests.

[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Vite on Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/).

## 14. Main 10-day risks

| Risk                                              | Impact / containment                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Undefined roles and approval authority            | Resolve Control Room mapping and officer action permissions before operational write routes             |
| Offline pump timing ambiguity                     | Resolve before Day 4; never invent runtime from a delayed server receipt                                |
| Missing real master data and unit definitions     | Use clearly marked fixtures; obtain verified station/pump/meter information before pilot                |
| No-data/compliance/threshold definitions          | Need shift schedules, expected frequency, grace periods, alert thresholds and time windows by Day 7     |
| Transfer accounting and meter resets              | Establish boundaries, reset evidence and zero-denominator behavior before calculations                  |
| Cloudflare account/domain/budget and password CPU | Verify access and benchmark early; measure rather than promise free-tier sufficiency                    |
| Physical Android validation                       | APK/Expo Go, camera/GPS permissions, connectivity interruption and native UI must be tested on a device |
| Late scope/testing compression                    | Keep daily milestones; no additional features; test each acceptance flow as it appears                  |
| Authoritative branding asset                      | Current logo folder is empty; identify the district asset before final branded release                  |
| Dependency/toolchain changes                      | Use version-pinned lockfile and SDK-compatible native packages; validate on Windows and CI              |

## 15. Contradictions and missing requirements

No major contradiction blocks foundation work. The following are unresolved requirements, not permission to expand scope:

- Control Room appears in the audience but not in the eight-role list.
- Server-owned start/stop timestamps coexist with general offline-write wording; PRD explicitly tests offline readings but does not define offline start/stop semantics.
- Expected reading schedules, missing-data grace periods, alert thresholds, pressure/tank units, energy targets and repeated-breakdown windows are unspecified.
- Water-balance network boundaries, terminal delivery, reservoir change and transit-time accounting are unspecified. Summing every transfer edge could double-count water.
- Meter reset approval and how valid consumption spans the reset need definition.
- Staff attendance/shift rules, task assignment and engineering verification permissions need clarification.
- Account provisioning/reset, first administrator, pilot hostname and cloud account are not supplied.
- Real station/pump data, district-logo selection, field language needs and photo retention requirements are not supplied.
- Milestone 1 predates login/mobile shell/web dashboard in TASKS. Its UI verification is therefore limited to real foundation connectivity screens. It does not claim operational flows are complete.

Proceed only with Milestone 1. Milestone 2 remains Auth & Masters: login/session lifecycle, users/roles/assignments, station master and pump master. Do not start it before foundation validation passes.
