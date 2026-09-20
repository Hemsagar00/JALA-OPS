# JALA-OPS — Engineering Rules

## Product rules
1. Build a working operational system, not a static demo.
2. Field workflows beat visual effects.
3. Deterministic calculations must not use AI.
4. Keep the 10-day MVP scope strict.
5. No AI, IoT, SCADA, paid SMS/WhatsApp or advanced GIS in Phase 1.

## Coding rules
1. TypeScript for application code.
2. Reuse shared types and validation.
3. No giant monolithic components.
4. No placeholder or fake-success buttons.
5. Do not hard-code dashboard totals when database data exists.
6. Handle loading, success, empty and error states.
7. Audit important mutations.
8. Never hard-delete critical operational records.

## Data rules
1. Server owns pump start/stop timestamps.
2. Reject negative meter deltas unless a reset event is recorded.
3. Running pump cannot be started again.
4. Stopped pump cannot be stopped again.
5. Breakdown closure requires completion evidence.
6. Offline writes use `client_uuid`.
7. Preserve original values in audit history.

## Quality loop
Plan → Implement → Type-check → Test → Build → Visual Check → Verify API→DB→UI → Fix → Update Docs → Continue.

Do not advance with a broken build.
