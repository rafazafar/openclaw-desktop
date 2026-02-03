# Roadmap — openclaw-desktop

## Phase 0 — Planning (this repo)
- PRD, Architecture, Integration model
- Open questions list

## Phase 1 — MVP: “Manager app” + Telegram
**Outcome:** user can install, turn On/Off, connect Telegram, and see basic status.
- Desktop app shell (Electron/Tauri decision)
- Local manager API (localhost)
- Start/stop OpenClaw
- Telegram bot token setup flow
- Diagnostics/log viewer

## Phase 2 — OAuth integration: Gmail (read-only first)
**Outcome:** user can connect Gmail and the assistant can summarize inbox.
- OAuth flow
- Keychain storage
- Permission toggles
- Minimal Gmail plugin configuration

## Phase 3 — Gmail send + guardrails
- “Confirm before sending”
- recipient allowlist
- audit log

## Phase 4 — Calendar
- connect + read events
- create events (confirm)

## Phase 5 — Polishing + distribution
- installer UX
- auto-update
- crash reporting (opt-in)

## Phase 6 — Ecosystem
- integrations marketplace model
- plugin signing considerations
