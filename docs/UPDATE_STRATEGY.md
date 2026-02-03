# Update Strategy — openclaw-desktop

## Purpose
Define how **openclaw-desktop** (the desktop “manager” app) updates itself and the components it manages (gateway runtime, plugins, config templates) in a way that is:
- **Safe** (signed, integrity-checked, minimal surprise)
- **Reversible** (rollback on failure)
- **Predictable** (channels, cadence, compatibility guarantees)
- **User-respectful** (clear prompts; defers when busy; offline-friendly)

This document is **implementation-free**: it specifies expected behaviors, flows, edge cases, and acceptance criteria.

---

## Scope
### In scope
1. **Desktop app updates** (the UI shell + local manager logic)
2. **Bundled/managed runtime updates** (e.g., the OpenClaw Gateway binary/service packaged with the desktop app)
3. **Plugin/extension package updates** (channel plugins, skills bundles, integration adapters)
4. **Config/schema migrations** that are triggered by updates
5. **Release channels** and update policies (auto/manual, notify-only)
6. **Rollback strategy** across all updateable components

### Out of scope
- Server-side updates for third-party services (Google, Telegram, etc.)
- Vendor-specific updater mechanics (e.g., exact Electron updater API calls)
- Detailed CI/CD pipeline configuration (covered elsewhere)

---

## Definitions
- **Component**: Updateable unit (Desktop App, Gateway Runtime, Plugins, Templates/Docs).
- **Release channel**: Stream of releases (Stable/Beta/Nightly).
- **Update policy**: Whether updates are automatic, manual, or notify-only.
- **Update artifact**: Signed package delivered to clients.
- **Version**: Semver-like string `MAJOR.MINOR.PATCH` (plus optional prerelease).

---

## Design goals & principles
1. **Security-first**
   - Updates MUST be signed.
   - Clients MUST verify integrity and signature before install.
   - Update metadata MUST be authenticated (not just the binary).

2. **Minimal downtime**
   - Prefer staged updates that keep the gateway running when possible.
   - If restart is required, allow deferral and schedule windows.

3. **Clear ownership**
   - The desktop app “owns” update orchestration.
   - The gateway can self-report version and health, but updates should not require a working gateway.

4. **Compatibility is explicit**
   - Each Desktop release declares compatible Gateway/Plugin ranges.
   - Migrations are version-gated and reversible when feasible.

5. **Rollback is a first-class feature**
   - Any failed update must be able to revert to last known-good state.

---

## Components & versioning
### 1) Desktop App
- **Versioned independently**.
- Update triggers:
  - Auto-check (on launch + periodic)
  - Manual “Check for updates”

### 2) Gateway Runtime (managed service)
- May be distributed as:
  - Bundled with the app installer
  - Downloaded on-demand (first run or when required)
- Must support **side-by-side installs** for rollback (at least “current” and “previous”).

### 3) Plugins / Skills / Integration packages
- Prefer **atomic package** updates (install fully, verify, then activate).
- Each plugin declares:
  - Supported Desktop version range
  - Supported Gateway version range

### 4) Config templates + schema
- Updates may require schema migrations.
- Migration must be deterministic and logged.
- If a migration changes user-visible behavior (permissions/policy), it must be surfaced.

---

## Release channels
### Channel options
- **Stable**: default; tested; slower cadence.
- **Beta**: opt-in; earlier features.
- **Nightly/Dev**: opt-in; for contributors; may break.

### Channel selection rules
- Channel is a user setting stored locally.
- Switching channels should:
  - Take effect immediately for update checks
  - Never silently downgrade without explicit consent

### Pinning and deferrals
- Optional “pin to version” (advanced setting) to prevent auto-updates.
- Deferral options:
  - “Later” (remind next launch)
  - “Defer 24h”
  - “Skip this version” (Stable/Beta only)

---

## Update policies
### Policy modes
1. **Auto-update (recommended)**
   - Downloads in background.
   - Installs at next safe opportunity.

2. **Notify-only**
   - Shows available updates; user triggers download/install.

3. **Manual only / Offline**
   - No automatic checks.
   - Allows importing an update bundle from disk.

### “Safe opportunity” definition
Updates that require restart or service interruption should only install when:
- No critical user flow is in progress (e.g., onboarding wizard mid-step)
- Gateway is not in a known critical state (e.g., mid-migration)
- User explicitly confirms, OR a scheduled maintenance window occurs

---

## High-level flows

### Flow A — Check for updates (all components)
**Purpose:** Determine whether Desktop/Gateway/Plugins have updates available.

1. User action: open “Updates” screen or app auto-check occurs.
2. App fetches **authenticated update manifest** for selected channel.
3. App compares:
   - Desktop version
   - Gateway runtime version
   - Installed plugin versions
4. App outputs an update plan:
   - What is available
   - What is required (compatibility)
   - Expected impact (restart required? downtime?)

**Edge cases:**
- Offline → show “Last checked at …” + allow retry.
- Captive portal / TLS interception → treat as untrusted, fail closed.

**Acceptance criteria:**
- Manifest is verified before being used.
- UI clearly distinguishes “available” vs “required”.

---

### Flow B — Download updates
**Purpose:** Retrieve artifacts for the update plan.

1. App starts background download per component.
2. Each artifact is written to a staging area.
3. On completion, app verifies:
   - hash/integrity
   - signature
   - basic metadata match (component id, version)

**Edge cases:**
- Partial downloads → resume or restart.
- Insufficient disk → show required space, allow cleanup.
- Proxy required → respect OS proxy settings.

**Acceptance criteria:**
- No component is installed unless verification passes.
- Downloads can be canceled.

---

### Flow C — Install Desktop update
**Purpose:** Update the Desktop app.

1. User chooses “Install now” or install is scheduled.
2. App ensures:
   - Settings and local state are persisted
   - Any background tasks are paused safely
3. Installer runs.
4. On first launch after update:
   - run post-update checks
   - show “What’s new” (optional)

**Edge cases:**
- Update requires elevated permissions (Windows) → prompt.
- Update fails mid-install → OS installer rollback, app returns to last working.

**Acceptance criteria:**
- App launches successfully after update.
- If update fails, user can still open the previous version.

---

### Flow D — Update Gateway runtime
**Purpose:** Update the managed gateway service without breaking connectivity.

1. Desktop downloads and verifies gateway artifact.
2. Desktop stops gateway service **only if needed**.
3. Desktop installs gateway side-by-side:
   - keep `previous` and `current`
4. Desktop starts gateway and waits for readiness signal.
5. If readiness fails:
   - rollback to previous gateway version
   - surface actionable error

**Edge cases:**
- Gateway running under different user context → detect and require admin.
- Port conflicts after restart → rollback or guided remediation.

**Acceptance criteria:**
- Gateway resumes with same config.
- Automatic rollback occurs on failed start.

---

### Flow E — Update plugins
**Purpose:** Update integration packages safely.

1. Desktop checks plugin compatibility matrix.
2. For each plugin:
   - download → verify → stage
   - activate only after verification
3. If activation fails:
   - revert to previous version
   - disable plugin if repeated failures, with clear UX

**Edge cases:**
- Plugin requires new permissions → prompt before activation.
- Plugin incompatible with current gateway → block and explain.

**Acceptance criteria:**
- Plugin updates are atomic.
- User can roll back or disable a plugin from UI.

---

## Compatibility & migration rules
### Compatibility matrix
Each Desktop release should specify:
- Minimum and maximum compatible Gateway version
- Minimum compatible plugin API version

### Migration types
1. **Config schema migration** (managed config file)
2. **Policy defaults migration** (policy changes must be explicit)
3. **Credentials storage migration** (must preserve security properties)

### Migration safety requirements
- Pre-migration backup is created (local, encrypted where appropriate).
- Migration is logged to a local audit trail.
- Migration can be retried idempotently.

---

## Rollback strategy
### When to rollback
- Signature/integrity verification failure
- Install step fails
- Post-install health check fails
- User triggers manual rollback

### Rollback scope
- Desktop app: rely on OS installer rollback; if not possible, provide a “download previous installer” path.
- Gateway: keep last-known-good binary + config; one-click revert.
- Plugins: keep previous version; revert on activation failure.

### Health checks (post-update)
Minimum required checks:
- Desktop: app launches, settings readable.
- Gateway: service starts, responds to local probe, reports version.
- Plugins: load/handshake probe succeeds.

---

## Security requirements
- Signed manifest and artifacts.
- Explicit trust anchors (bundled public keys) and rotation strategy.
- Protect against rollback attacks:
  - Do not allow installing artifacts below a configured minimum version unless user explicitly overrides.
- Use secure transport (TLS) with sane defaults.

---

## UX requirements
- Dedicated “Updates” screen showing:
  - Current versions (Desktop, Gateway, Plugins)
  - Available versions and channel
  - Last checked time
  - Impact notes (restart required, permission changes)
- Clear errors with next steps.
- Ability to export a small “update log” snippet for support.

---

## Telemetry / diagnostics (optional)
If enabled by the user:
- Log update attempts, success/failure reasons, durations.
- Never include secrets.
- Provide a toggle and a privacy note.

---

## Edge cases checklist
- Offline installs via imported bundles
- User behind enterprise proxy / MITM
- Low disk space
- Interrupted power during install
- Concurrent update attempts (two windows, background scheduler)
- Gateway currently in crash loop
- Plugin repeatedly failing to activate
- User switches channels and sees a “downgrade” available

---

## Acceptance criteria (summary)
- [ ] Update manifest is authenticated and verified.
- [ ] Artifacts are verified (integrity + signature) before install.
- [ ] Desktop app updates are user-transparent with safe restart prompts.
- [ ] Gateway runtime update supports automatic rollback on failed start.
- [ ] Plugin updates are atomic with compatibility checks.
- [ ] Migrations are backed up, logged, and idempotent.
- [ ] UI communicates impact, offers deferral, and provides troubleshooting info.
