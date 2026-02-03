# Config Generation — openclaw-desktop

## Purpose
Define how **openclaw-desktop** generates, owns, and migrates the OpenClaw gateway configuration so that:
- non-technical users never edit YAML/JSON manually
- integrations and permissions are represented in plain language
- upgrades do not silently break user setups
- power users can still opt into “advanced / manual” control without losing data

This doc is intentionally **implementation-free**. It specifies responsibilities, states, and acceptance criteria.

---

## Scope
### In scope
- Where configuration lives on disk (and what is owned by the app vs user).
- The canonical “source of truth” model inside the desktop app.
- How the app materializes that model into an OpenClaw config file.
- How changes are applied (restart/reload expectations, validation steps).
- Migration strategy across app versions.
- Separation of secrets (tokens/keys) from non-secret config.

### Out of scope
- Exact OpenClaw config schema (see `docs/API_SPEC.md` for UI↔manager API shape).
- Exact OS-specific secure storage APIs.
- Code-level merge algorithms.

---

## Definitions
- **App model (canonical state):** The structured representation of user choices managed by openclaw-desktop (integrations connected, permissions toggles, model profile, channel configuration, update settings).
- **Generated OpenClaw config:** The file handed to the OpenClaw gateway process.
- **Secrets store:** OS keychain/credential manager (or equivalent) used for OAuth tokens, API keys, signing keys.
- **User override config (advanced):** Optional user-managed config fragments that can extend/override generated values.
- **Config generation version:** A version identifier that indicates which generator rules produced the current generated config.

---

## Design principles
1. **Single source of truth:** UI state is authoritative; generated config is a build artifact.
2. **Safe by default:** If a user option implies increased risk (e.g., “allow send email”), it must be explicit in the app model and reflected clearly.
3. **Deterministic output:** Given the same app model and generator version, the generated config is stable (helps debugging/support).
4. **Secrets never in plain config:** Tokens/keys remain in secure storage; config references them indirectly (e.g., by key name/handle).
5. **Human-readable artifacts:** Generated config should be readable for support, with comments/metadata where possible.
6. **Recoverability:** The user can reset to a known-good configuration without losing secrets unless they choose to disconnect.

---

## Filesystem layout (normative)
openclaw-desktop maintains a dedicated application data directory.

**Recommended conceptual structure:**
- `app-state.json` — canonical app model (non-secret)
- `openclaw.generated.(yml|json)` — generated OpenClaw config (non-secret)
- `openclaw.user.override.(yml|json)` — optional user override fragment (advanced; non-secret)
- `migrations/` — migration markers or backups
- `logs/` — desktop-level logs (not gateway logs)

### Ownership rules
- `app-state.json` and `openclaw.generated.*` are **owned by openclaw-desktop**.
- `openclaw.user.override.*` is **owned by the user** (only created/edited in “Advanced” mode).
- Secrets are **owned by the OS secure store** and managed via connect/disconnect flows.

---

## Canonical app model
The app model must capture user intent without mirroring the entire OpenClaw config.

### Required fields (conceptual)
- **Profile:** selected model/cost profile (e.g., Cheapest/Balanced/Coding)
- **Gateway lifecycle settings:** auto-start on login, start minimized, port settings (if configurable)
- **Integrations:** for each integration
  - connection state (connected/disconnected)
  - account identity (display email / handle)
  - permission toggles (read/summarize vs send)
  - last successful health check timestamp
- **Channels:** e.g., Telegram
  - enabled/disabled
  - identity/metadata needed for routing (non-secret)
- **Policies:** confirm-before-send, allowlists, data retention choices
- **Update preferences:** auto-update on/off, update channel

### Derived/generated fields
- OpenClaw plugin entries, feature flags, and capability settings are derived from the app model at generation time.

---

## Generation process
### When generation occurs
Generation is triggered by:
- first-run setup completion
- connect/disconnect an integration
- change a permission toggle
- change model profile
- change policy settings
- update of generator rules (app upgrade) requiring migration

### Generation stages
1. **Load canonical model** from `app-state.json`.
2. **Validate model** (required fields present; incompatible settings rejected with clear UI error).
3. **Resolve secrets references** (ensure required secrets exist in secure store; never embed secret values).
4. **Render generated config** for OpenClaw.
5. **Optionally merge advanced overrides** (see next section).
6. **Validate generated config** against an OpenClaw schema/validator (or a known-good sanity check).
7. **Write atomically**:
   - write to a temp file
   - fsync/flush
   - rename into place
8. **Apply** by restarting/reloading the gateway as required.

### Atomicity and safety
- If any stage fails, the existing generated config remains unchanged.
- A backup of the prior generated config is retained for rollback (at least 1 version).

---

## Advanced overrides (optional)
Advanced mode is for power users who want to add unsupported plugins or tweak parameters.

### Merge rules
- **Generated config remains the base.** Overrides are applied on top.
- The UI must clearly communicate that:
  - overrides may cause unsupported behavior
  - some UI settings may not reflect override values

### Conflict policy
- If an override changes a field also controlled by the UI (e.g., gateway port), the app must choose one of:
  1) **UI wins** (override ignored for managed keys), or
  2) **Override wins** (UI shows “Overridden” state), or
  3) **Hard error** requiring user resolution

Pick one policy and apply consistently. For MVP, prefer **UI wins for managed keys** with a visible warning listing overridden keys.

### Safety constraints
- Overrides must not be able to exfiltrate secrets from secure storage through template substitution.
- If overrides enable new outbound channels/integrations, the app should require an explicit user confirmation.

---

## Applying config to the gateway
### Apply semantics
- Changes that affect integrations, channels, or policies generally require the gateway to **reload config**.
- If OpenClaw does not support hot reload, openclaw-desktop performs a **restart**.

### User experience
- The UI shows:
  - “Applying changes…” progress state
  - if a restart is needed
  - the previous running status if apply fails

### Failure behavior
If apply fails:
- gateway should return to the last-known-good configuration
- UI surfaces actionable error text and a “View diagnostics” link

---

## Migration strategy
Upgrades can change how generation maps app model → OpenClaw config.

### Versioning
- Store a **config generation version** in app state and in generated config metadata.
- On startup after upgrade:
  - detect version mismatch
  - run deterministic migrations on app state and/or regeneration rules

### Migration goals
- Preserve user intent (connected integrations, policy toggles, selected profile).
- Never drop permissions to a *less safe* state without explicit user consent.
  - Example: if a new version introduces “send email” as a separate toggle, default it to **off** even if the old version implicitly allowed sending.

### Backups and rollback
- Keep at least:
  - last working `openclaw.generated.*`
  - a timestamped copy of `app-state.json` before migration
- If migration fails:
  - restore backups
  - keep the gateway stopped (or running old config, depending on safety)
  - show a clear recovery screen with next steps

---

## Edge cases
- **Secrets missing:** app state says Gmail is connected but tokens are missing in secure storage.
  - Expected: mark integration as “Needs reconnect”; generation blocks only features that require the secret.
- **Partial connectivity:** integration connected but health checks fail (revoked/expired token).
  - Expected: keep config, but UI prompts re-auth; do not delete secrets automatically.
- **User edits generated file manually:** the app detects drift.
  - Expected: warn and regenerate (generated file is not user-owned).
- **Override file invalid:** parse error or schema mismatch.
  - Expected: reject apply; UI points to override file path and error.
- **Port conflicts / gateway cannot bind:** apply fails.
  - Expected: show conflict guidance; allow selecting a new port (if supported).
- **Downgrade:** user installs older app version.
  - Expected: app warns that state may be incompatible; offer export/back up.
- **Multiple accounts for one integration (future):**
  - Expected: model supports multiple identities; generator produces explicit account selection.

---

## Acceptance criteria
1. **No secrets in plaintext config:** OAuth tokens/API keys are not written into `openclaw.generated.*` or any non-secure file.
2. **Deterministic generation:** Regenerating without state changes produces byte-identical (or semantically identical) output.
3. **Atomic apply:** Failed generation or validation never corrupts the last working config.
4. **User intent preserved across upgrades:** After upgrade, connected integrations and permission toggles remain correct (or become safer by default with explicit re-consent).
5. **Clear UX on failure:** Users can see why apply failed and what to do next.
6. **Advanced mode containment:** User overrides cannot silently change managed safety-critical settings without a visible warning.

---

## Open questions
- Which merge policy should apply for managed keys in advanced overrides (UI wins vs override wins)?
- Should openclaw-desktop support “export config” as a support/debugging feature (and if so, what gets redacted)?
- Should there be a “Reset to defaults” action that preserves secrets but resets model/policies?
