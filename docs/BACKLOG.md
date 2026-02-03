# Backlog — openclaw-desktop

## Purpose
Provide a **prioritized, implementation-free** backlog derived from the PRD, Roadmap, and supporting specs.

This backlog is intended to:
- make scope tradeoffs explicit
- define “done” for each item (acceptance criteria)
- serve as the source list for issues/sprints

## Scope
- Covers **product + engineering** work items for the desktop “manager app” MVP and the next planned phases.
- Does **not** include code tasks, specific libraries, or file-level design.

## How to read / use
- **P0**: required for the next shippable milestone
- **P1**: strongly recommended; unlocks important capabilities or reduces risk
- **P2**: nice-to-have or polish

Each item includes:
- **User value** (why it matters)
- **Primary flows** (what the user does)
- **Edge cases** (what can go wrong)
- **Acceptance criteria** (testable outcomes)

---

## Milestone map (high level)
- **M1 — Desktop manager MVP (Telegram)**: on/off, connect Telegram, view status/logs
- **M2 — Permissions framework**: permission catalog + toggles + enforcement + audit
- **M3 — Gmail read-only**: OAuth, store tokens, enable read scopes
- **M4 — Gmail send (guarded)**: confirm-before-send, allowlist
- **M5 — Calendar**: connect/read/create (guarded)
- **M6 — Packaging polish**: installers, updates, support bundle polish

---

## P0 backlog (must-have)

### P0-1: Desktop app shell (single-window manager)
**User value:** a non-developer can operate OpenClaw without CLI.

**Primary flows**
- Launch app and see gateway status.
- Turn On / Turn Off.
- Navigate between: Integrations, Permissions (stub), Status/Logs.

**Edge cases**
- App starts while gateway is already running.
- App starts while gateway is corrupted/unavailable.

**Acceptance criteria**
- A single app window exists with an explicit On/Off control and a status area.
- Status reliably reflects running/stopped within a reasonable refresh interval.
- UI communicates “starting…” and “stopping…” transient states.

---

### P0-2: Manager ↔ Gateway lifecycle control
**User value:** safe, predictable control of the local assistant.

**Primary flows**
- Start gateway.
- Stop gateway.
- Restart gateway (explicit button or implicit during configuration changes).

**Edge cases**
- Start requested while already starting.
- Stop requested while gateway is busy.
- Gateway crashes unexpectedly.

**Acceptance criteria**
- Start/Stop operations are idempotent from the user perspective.
- UI shows clear error text when lifecycle actions fail.
- Crash is detected and surfaced with a “Start again” option.

---

### P0-3: Local Manager API + UI auth posture (baseline)
**User value:** reduces risk of local takeover; establishes security foundation.

**Primary flows**
- App communicates with local manager components.
- Non-app processes are not able to silently perform privileged actions.

**Edge cases**
- Another local process attempts to call manager endpoints.

**Acceptance criteria**
- A documented “baseline local auth” approach exists (token/nonce/session concept).
- Sensitive actions (token reveal/export, connect/disconnect) require the baseline auth.
- Threats and mitigations link back to `SECURITY_THREAT_MODEL.md`.

---

### P0-4: Telegram channel connection flow
**User value:** user can actually talk to the assistant quickly (MVP metric).

**Primary flows**
- User enters Telegram bot token (or guided instructions for obtaining it).
- User validates connection.
- User disconnects Telegram.

**Edge cases**
- Invalid token.
- Token revoked.
- Telegram blocked by network.

**Acceptance criteria**
- “Connect Telegram” results in a clear connected state.
- Disconnect removes channel configuration and stops further message delivery.
- Error states match the UX expectations in `UX_EDGE_CASES.md`.

---

### P0-5: Configuration generation + safe writes
**User value:** integrations can be managed without manual file editing; prevents config corruption.

**Primary flows**
- Enabling/disabling an integration regenerates config.
- App informs user when restart/reload is required.

**Edge cases**
- Partial writes / disk full.
- Existing user-managed config present.

**Acceptance criteria**
- Config ownership and migration behavior match `CONFIG_GENERATION.md`.
- A failure to write config never leaves the system in an unknown half-configured state.
- User can always revert by “Disconnect integration” and “Turn Off”.

---

### P0-6: Status + logs viewer (basic)
**User value:** user can self-diagnose and share actionable info with support.

**Primary flows**
- View current status: running, version, integrations connected.
- View recent logs with copy/export.

**Edge cases**
- Logs contain sensitive tokens.

**Acceptance criteria**
- Logs view clearly labels “may contain sensitive data” where applicable.
- A redaction strategy exists per `SUPPORT_BUNDLE_SPEC.md`.

---

## P1 backlog (next most important)

### P1-1: Permissions catalog + UI presentation
**User value:** the user understands and controls what the assistant can do.

**Primary flows**
- User sees a list of permissions per integration.
- User can toggle permissions on/off.

**Edge cases**
- Disabling a permission that is required for an already-connected integration.

**Acceptance criteria**
- Permission names and descriptions align with `PERMISSIONS.md`.
- UI clarifies which permissions are required vs optional.
- Changes are persisted and reflected in generated configuration.

---

### P1-2: Policy enforcement hooks (baseline)
**User value:** prevents unsafe actions (e.g., sending email) without explicit consent.

**Primary flows**
- User enables “Confirm before sending” for send-capable integrations.
- User sets a recipient allowlist.

**Edge cases**
- Policy disabled accidentally.

**Acceptance criteria**
- Enforcement model aligns with `POLICY_ENFORCEMENT.md`.
- Policies are clearly communicated in the UI and included in the support bundle (redacted).

---

### P1-3: Support bundle export (MVP)
**User value:** dramatically speeds up troubleshooting.

**Primary flows**
- User clicks “Export support bundle”.
- A shareable artifact is created.

**Edge cases**
- User denies file write permissions.

**Acceptance criteria**
- Export contents match `SUPPORT_BUNDLE_SPEC.md`.
- Bundle includes explicit redaction notes.

---

### P1-4: Accessibility baseline
**User value:** app is usable with keyboard and screen readers.

**Acceptance criteria**
- Meets requirements in `ACCESSIBILITY.md` for the MVP surfaces.

---

## P2 backlog (later / polish)

### P2-1: OAuth (Gmail read-only) onboarding polish
**User value:** reduces drop-off during credential setup.

**Acceptance criteria**
- Copy and warnings align with `ONBOARDING_COPY.md`.

---

### P2-2: Auto-update + rollback (distribution)
**User value:** keeps users secure and reduces manual maintenance.

**Acceptance criteria**
- Matches `UPDATE_STRATEGY.md` and `DISTRIBUTION_PACKAGING.md`.

---

### P2-3: Crash reporting (opt-in)
**User value:** improves stability without violating user trust.

**Acceptance criteria**
- Fully opt-in with clear disclosure; never includes tokens.

---

## Future-phase backlog (placeholders, to be expanded later)

### Gmail read-only (M3)
- OAuth BYO credentials
- Token storage
- Permission toggles for read scopes
- Verify assistant can perform inbox summarization

### Gmail send guarded (M4)
- Confirm-before-send UI
- Recipient allowlist
- Audit trail of send attempts

### Calendar (M5)
- Connect/read events
- Create events (confirm)

---

## Backlog hygiene
- When implementation begins, each backlog item should be split into one or more issues with:
  - owner
  - milestone
  - explicit test plan
  - links to relevant docs (PRD/Architecture/Policies)
