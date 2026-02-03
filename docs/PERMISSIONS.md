# Permissions & Consent — openclaw-desktop

## Goal
Make “what the assistant can do” explicit, revocable, and understandable.

Non-dev users think in terms of **capabilities**:
- “Can read my email”
- “Can send email”
- “Can read my calendar”
- “Can message me on Telegram”

Not in terms of config files or OAuth scopes.

---

## Principles
- **Least privilege by default**
- **Separate read vs write** permissions
- **Visible and reversible**: toggles + disconnect + delete tokens
- **Explain consequences** in plain language

---

## Permission types (proposed)
### Data access
- Read metadata only (safer)
- Read full content (higher risk)

### Actions
- Send email
- Create calendar event
- Delete/modify data (avoid in MVP unless necessary)

### Guardrails
- Recipient allowlist (contacts/domains)
- Rate limits
- “Confirm before sending” toggle

---

## Consent UX
- When connecting an integration, show:
  - what will be accessible
  - what actions can be taken
  - where to revoke
- If enabling a “write” permission (send/create): show an extra confirmation screen.

---

## Mapping to implementation
Internally, permissions map to:
- OpenClaw plugin settings
- agent/system prompt constraints
- optional policy enforcement in the manager

Open question: enforcement should ideally be **hard** (policy layer) not just “prompt-based”.
See `docs/OPEN_QUESTIONS.md`.
