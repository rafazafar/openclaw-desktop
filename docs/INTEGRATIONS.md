# Integrations — openclaw-desktop

## Overview
Integrations are presented as user-facing “connectable services” (Gmail, Calendar, Telegram, etc.).

The desktop app provides:
- a guided connection flow
- a permissions summary
- disconnect/revoke actions

The manager maintains connection state and writes any needed OpenClaw configuration.

---

## Integration contract (proposed)
Each integration module should define:
- `id`: stable identifier (e.g. `gmail`, `gcal`, `telegram`)
- `displayName`
- `description`
- `authType`: `oauth` | `apiKey` | `none`
- `scopes` (for OAuth)
- `permissions` list (human readable)
- `capabilities` mapping to OpenClaw config/plugin settings

---

## Gmail (example)
### Connection
- OAuth 2.0 via browser
- Callback to localhost (manager)

### Permissions model
Split into toggles:
- Read
  - read metadata (from, subject, date)
  - read bodies (optional, explicitly enabled)
- Send
  - allow composing and sending emails
  - optional allowlist of recipient domains/contacts

### UX
- “Connect Gmail”
- After connect: show email address + toggles

---

## Telegram (example)
Telegram is a channel integration rather than OAuth.

Connection:
- create bot token via BotFather
- paste token OR open link instructions

Security:
- show the chat(s) connected
- allow disconnect

---

## Implementation notes (later)
- Prefer adding integrations as plugins without modifying OpenClaw core.
- If OpenClaw needs new integration APIs, upstream contributions are preferred.
