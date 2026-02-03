# openclaw-desktop

A consumer-friendly desktop app for OpenClaw.

**Goal:** make OpenClaw feel like Claude Desktop / ChatGPT Desktop:
- simple **On/Off** toggle
- **Connect Gmail / Calendar / Telegram** with guided OAuth flows
- clear **capabilities + consent** (what the assistant can do)
- safe defaults + easy troubleshooting

This repo currently contains **architecture + PRDs only** (no implementation yet).

## Documents
- `docs/PRD.md` — product requirements (MVP + non-goals)
- `docs/ARCHITECTURE.md` — proposed architecture and component boundaries
- `docs/INTEGRATIONS.md` — integration model, consent, and OAuth flows
- `docs/PERMISSIONS.md` — permission system and policy ideas
- `docs/ROADMAP.md` — milestones and sequencing
- `docs/OPEN_QUESTIONS.md` — decisions needed before coding

## Guiding principles
- **No fork by default**: treat upstream OpenClaw as the engine.
- **Local-first**: runs on the user’s machine.
- **Explicit consent**: every integration/action is visible and revocable.
- **Secure storage**: tokens/credentials stored in OS keychain when possible.

## Status
Planning stage.
