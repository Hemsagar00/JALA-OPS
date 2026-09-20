# JALA-OPS Agent Instructions

Before changing code, read:

- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/RULES.md
- docs/DESIGN.md
- docs/TASKS.md
- docs/MEMORY.md

Authority order:

1. PRD.md — product scope
2. ARCHITECTURE.md — technical architecture
3. RULES.md — engineering constraints
4. DESIGN.md — UI/UX rules
5. TASKS.md — execution order
6. MEMORY.md — persistent project context

Build milestone by milestone.

After every milestone:

- run type checks
- run tests
- run build
- verify API → database → UI flow
- visually review mobile and web UI
- fix blocking errors before continuing

Do not add AI, IoT, SCADA, paid SMS, WhatsApp, or complex GIS in the MVP.

Use Apple Design Skill for UX/accessibility review.
Use Expo skills for the mobile app.
Preserve JALA-OPS Sri Sathya Sai District branding.
