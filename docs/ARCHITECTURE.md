# Architecture — openclaw-desktop

## 1. Top-level approach
**Do not fork OpenClaw by default.** Treat OpenClaw as the local “engine” and build a desktop UX layer around it.

This repo proposes a **two-layer architecture**:
1) **Desktop App** (UI + onboarding + permissions)
2) **Local Control Plane** (a small manager process that starts/stops OpenClaw, manages config + secrets)

OpenClaw itself remains largely unchanged.

---

## 2. Components

### 2.1 Desktop UI (Electron or Tauri)
Responsibilities:
- UX: On/Off, connect/disconnect integrations, settings
- Runs OAuth flows (browser → callback)
- Displays permissions and asks for consent
- Shows system status and helpful errors

Out of scope (initially): being the full chat client.

### 2.2 Local Manager ("clawctl")
A local background service (or embedded process) used by the UI.

Responsibilities:
- start/stop/restart OpenClaw gateway
- read/write OpenClaw config safely (patch-based)
- store secrets securely (OS keychain) and expose token handles to config
- provide a stable **local HTTP API** for the UI (localhost only)
- maintain a simple state store:
  - what integrations are connected
  - what permissions are enabled
  - last health check results

### 2.3 OpenClaw Gateway (upstream)
Runs as a child process or separate process launched by the manager.

The manager should use:
- existing OpenClaw CLI (`openclaw gateway start/stop/status`) if sufficient
- otherwise direct process management

Prefer *minimal coupling*.

---

## 3. Local API (Manager ↔ UI)
Expose a localhost-only API.

Suggested endpoints (initial):
- `GET /status` → gateway state, versions
- `POST /gateway/start | /stop | /restart`
- `GET /integrations` → list installed/available integrations
- `POST /integrations/:id/connect` → returns `auth_url` (or begins flow)
- `POST /integrations/:id/callback` → finalizes OAuth token storage
- `POST /integrations/:id/disconnect`
- `GET /permissions` → human-readable permissions
- `POST /permissions` → toggle/patch

Security:
- bind to `127.0.0.1`
- CSRF protection and random per-install API token
- optional OS-level authentication later

---

## 4. Secret storage
Preferred: OS keychains
- macOS Keychain
- Windows Credential Manager
- Linux Secret Service (later)

Design principle:
- UI and OpenClaw should not receive raw long-lived secrets unless necessary.
- The manager can supply tokens to OpenClaw via env injection or local file with strict ACL.

---

## 5. Config management
Instead of users editing YAML:
- manager maintains a canonical config model
- writes OpenClaw config as a generated artifact
- supports “patch” operations to reduce merge conflicts

Need a clear “ownership boundary” to avoid fighting user edits.

---

## 6. Integration model
Each integration should have:
- metadata (name, description, required scopes)
- connection flow (OAuth / API key)
- permissions mapping (what capabilities it enables)

See `docs/INTEGRATIONS.md`.

---

## 7. Update strategy
- Desktop app updates via standard auto-update for chosen framework.
- OpenClaw updates can be:
  - bundled with app releases (simpler)
  - or downloaded by manager (more complex)

MVP: bundle a known-good OpenClaw version.

---

## 8. Observability
Minimum for MVP:
- “Last error” summary with copy button
- “Open logs” button
- “Run diagnostics” button that produces a support bundle

---

## 9. Packaging
Targets:
- macOS notarized app
- Windows installer

Bundled assets:
- OpenClaw binary/CLI
- Manager service

---

## 10. Why not a fork?
Forking OpenClaw to add UI creates long-term maintenance burden.
This architecture keeps OpenClaw upstream-compatible while allowing consumer-grade UX.
