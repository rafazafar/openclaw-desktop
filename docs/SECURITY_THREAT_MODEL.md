# Security & Threat Model — openclaw-desktop

## Scope
Local-first consumer desktop manager for OpenClaw.

Assets:
- OAuth tokens (Gmail/Calendar)
- local manager API token
- user messages (Telegram)
- OpenClaw config/state

---

## Threats

### 1) Local API abuse
**Threat:** Another local process calls manager API to enable permissions or exfiltrate data.

Mitigations:
- random bearer token stored in keychain
- bind to 127.0.0.1 only
- rate limiting
- minimize API surface
- optional OS user confirmation for dangerous actions (future)

### 2) Token exfiltration
**Threat:** Tokens stored in plaintext files.

Mitigations:
- OS keychain storage
- never write raw tokens to config
- support “disconnect + delete tokens”

### 3) Prompt injection leading to dangerous actions
**Threat:** User receives a malicious email or message that tricks the agent.

Mitigations:
- default to read-only permissions
- require explicit confirmation for write actions
- implement hard policy enforcement in manager where possible
- audit log

### 4) Supply chain / updates
**Threat:** Auto-update delivers compromised binaries.

Mitigations:
- signed releases
- pinned OpenClaw version in MVP
- checksum verification for downloads

### 5) Unauthorized Telegram control
**Threat:** Bot is added to group chats, or token leaked.

Mitigations:
- show connected chat ids
- allowlist chats
- revoke token + regenerate guidance

---

## Security posture (MVP)
- Manager is the policy gate.
- UI is untrusted-ish; manager validates requests.
- Prefer hard enforcement over prompt-only.

---

## Privacy
- Provide a “privacy mode” toggle: avoid showing message contents in logs.
- Support bundle export should redact tokens and PII by default.
