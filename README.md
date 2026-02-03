# openclaw-desktop

A consumer-friendly desktop app for OpenClaw.

**Goal:** make OpenClaw feel like Claude Desktop / ChatGPT Desktop:
- simple **On/Off** toggle
- **Connect Gmail / Calendar / Telegram** with guided OAuth flows
- clear **capabilities + consent** (what the assistant can do)
- safe defaults + easy troubleshooting

This repo currently contains **architecture + PRDs only** (no implementation yet).

## Documents
Core:
- `docs/PRD.md` — product requirements (MVP + non-goals)
- `docs/ARCHITECTURE.md` — architecture and component boundaries
- `docs/ROADMAP.md` — milestones and sequencing
- `docs/MILESTONES.md` — milestone checklist

Product/UX:
- `docs/UI_WIREFRAMES.md` — text wireframes + navigation
- `docs/PERMISSIONS.md` — permission system and policy ideas
- `docs/INTEGRATIONS.md` — integration model + flows

Engineering specs:
- `docs/API_SPEC.md` — localhost manager API contract
- `docs/DATA_MODEL.md` — state model + generated config
- `docs/SECURITY_THREAT_MODEL.md` — threat model + mitigations
- `docs/OAUTH_STRATEGY.md` — Google OAuth approach (BYO creds → shared later)
- `docs/DISTRIBUTION_PACKAGING.md` — packaging/update strategy
- `docs/TESTING_STRATEGY.md` — testing pyramid
- `docs/REPO_STRUCTURE.md` — future monorepo layout

Meta:
- `docs/WORKFLOWS.md` — operational workflows
- `docs/GLOSSARY.md` — terms
- `docs/OPEN_QUESTIONS.md` — decisions needed before coding

## Guiding principles
- **No fork by default**: treat upstream OpenClaw as the engine.
- **Local-first**: runs on the user’s machine.
- **Explicit consent**: every integration/action is visible and revocable.
- **Secure storage**: tokens/credentials stored in OS keychain when possible.

## Status
Planning stage.
