# UX Edge Cases & Error States — openclaw-desktop

## Purpose
Capture the non-happy-path UX requirements for **openclaw-desktop** so implementation can be consistent, debuggable, and safe.

This doc is **implementation-free**: it defines *what the user experiences*, not how it’s coded.

## Scope
Covers edge cases and error states for:
- First run + gateway lifecycle
- Connecting/disconnecting integrations (esp. OAuth)
- Permissions & consent toggles (read vs write)
- Basic status/log surfaces
- Support flows (handoff into Support Bundle spec)

Out of scope:
- Provider-specific low-level errors (handled by integration plugins)
- Full “chat UI” (the desktop app is primarily a manager UI in MVP)

## UX principles for failures
- **Be explicit**: say *what failed* and *what the user can do next*.
- **Never blame the user**.
- **Prefer actionable wording** over stack traces.
- **Fail closed for write permissions** (e.g., sending email) unless the user re-enables.
- **Offer a copy-to-clipboard debug snippet** (error code + timestamp) whenever possible.
- **Avoid loops**: if we detect repeated failure, switch to guided troubleshooting.

## Surfaces (where errors appear)
- **Inline on the relevant integration card** (primary)
- **Global banner/toast** for app-wide problems (gateway down, update required)
- **Details drawer / “Show details”** (secondary) for timestamps, last attempt, and next steps

## Common states (shared vocabulary)
- **Not connected**: no tokens/credentials present.
- **Connecting…**: OAuth window open, waiting for callback.
- **Connected**: read-only or read+write permissions active.
- **Attention needed**: previously connected, but currently broken (revoked, expired, network).
- **Paused**: user intentionally disabled integration without deleting tokens.

---

# 1) First run & gateway lifecycle

## 1.1 Gateway fails to start
**Symptoms**: status stays “Starting…” then error.

**Possible causes**
- Missing/bad binary, corrupted install
- Port already in use
- Insufficient permissions
- Security software blocking execution

**User-facing behavior**
- Integration cards are disabled.
- Show banner: “OpenClaw couldn’t start.”
- Primary action: **Try again**
- Secondary actions:
  - **View details** (shows port, last error time, and a short reason)
  - **Open troubleshooting** (links to a help page in-app)
  - **Export support bundle** (if available)

**Acceptance criteria**
- User can always get back to a stable UI (no infinite spinner).
- “Try again” does not duplicate background processes.

## 1.2 Gateway starts but becomes unhealthy
**Symptoms**: was running, then switches to “Needs attention” / “Disconnected”.

**User-facing behavior**
- Banner: “OpenClaw stopped responding.”
- Actions:
  - **Restart OpenClaw** (primary)
  - **View logs** (secondary)

**Edge cases**
- If restart fails twice within 5 minutes, suggest exporting a support bundle.

## 1.3 Port conflict
**User-facing behavior**
- Message: “Another app is using the OpenClaw port.”
- Provide a plain-language hint: “This can happen if another OpenClaw instance is running.”
- Actions:
  - **Quit other instance** (help text only)
  - **Change port** (if supported by product requirements)
  - **Try again**

**Acceptance criteria**
- The message includes the port number.

## 1.4 Offline / restricted network
**User-facing behavior**
- Banner: “You appear to be offline.”
- Integration cards show: “Waiting for network”.

**Edge cases**
- Captive portals: indicate “Network sign-in may be required.”

---

# 2) OAuth & integration connection flows

## 2.1 User closes OAuth window
**User-facing behavior**
- Return to “Not connected” state.
- Show a non-alarming message: “Connection canceled.”
- Offer **Connect** again.

**Acceptance criteria**
- No partial/invalid tokens are stored.

## 2.2 OAuth denied by user
**User-facing behavior**
- State: “Not connected”.
- Message: “Access wasn’t granted. To connect, approve access in the next step.”

## 2.3 OAuth callback not received (timeout)
**User-facing behavior**
- After a reasonable timeout, show: “Still waiting for approval.”
- Actions:
  - **Open browser again**
  - **Cancel**
  - **Troubleshoot** (mentions firewall/VPN)

**Edge cases**
- Localhost redirect blocked by corporate firewall/VPN.

## 2.4 OAuth invalid_client / misconfigured credentials
**User-facing behavior**
- State: “Needs attention”.
- Message: “This integration is misconfigured.”
- Provide a short explanation: “The app’s Google credentials may be missing or incorrect.”
- Action: **Fix setup** (takes user to required inputs / setup instructions).

**Acceptance criteria**
- Message avoids exposing client secrets.

## 2.5 OAuth token expired / refresh failed
**User-facing behavior**
- State: “Attention needed”.
- Message: “Your connection needs to be refreshed.”
- Actions:
  - **Reconnect** (primary)
  - **Disconnect**

**Edge cases**
- If refresh fails repeatedly, indicate “Google may have revoked access.”

## 2.6 OAuth scopes changed (new permissions requested)
**Scenario**: product update requires additional scopes.

**User-facing behavior**
- State: “Attention needed”.
- Message: “Additional permission is required to keep using Gmail.”
- Show a bullet list of *what’s new* and why.
- Action: **Review & approve**.

**Acceptance criteria**
- The UI differentiates “new read access” vs “new write access”.

## 2.7 Account mismatch
**Scenario**: user expects one account, OAuth returns a different Google account.

**User-facing behavior**
- Before completing connection, show: “Connect as: user@gmail.com” with **Change account**.
- If mismatch detected after connection, show: “Connected as X” clearly.

---

# 3) Permissions & consent edge cases

## 3.1 Enabling a write permission requires confirmation
**Scenario**: toggling “Send email” / “Create calendar event”.

**User-facing behavior**
- Interstitial confirmation:
  - What it enables
  - Example of what could happen
  - Link: “How to revoke”
- Buttons: **Enable** / **Cancel**

**Acceptance criteria**
- Cancel leaves the permission disabled.

## 3.2 Permission enabled but policy blocks action
**Scenario**: user enabled send, but policy (allowlist / confirm-before-send) blocks.

**User-facing behavior**
- On the permission screen, show the active guardrails:
  - “Confirm before sending: On”
  - “Allowed recipients: …”
- If an action is blocked, the user should see a clear reason in logs/activity.

## 3.3 Revoked permissions at provider side
**Scenario**: user revokes Google access in Google account settings.

**User-facing behavior**
- Integration flips to “Attention needed”.
- Message: “Access was revoked.”
- Actions: **Reconnect** / **Disconnect**

## 3.4 Disconnect while gateway is off
**User-facing behavior**
- Allow disconnect to proceed (tokens removed).
- If gateway must be restarted to fully apply, show: “Changes will apply next time OpenClaw starts.”

---

# 4) Status, logs, and diagnosability

## 4.1 Error details without leaking secrets
**Requirement**
- User-visible details should not include:
  - OAuth access tokens / refresh tokens
  - API keys
  - full email contents

**UX behavior**
- Provide:
  - Timestamp
  - Integration name
  - High-level error class (e.g., “auth”, “network”, “rate limit”)
  - Copyable “Error ID”

## 4.2 Rate limits / quota exceeded
**User-facing behavior**
- Message: “This service is rate-limiting requests.”
- Show “Try again after: (if known)”
- Provide link: “How to reduce usage” (cost controls / model profile)

## 4.3 Partial degradation
**Scenario**: read works but write fails.

**User-facing behavior**
- Integration shows: “Connected (read-only)” with an alert “Sending is unavailable.”
- Provide “Fix” CTA.

---

# 5) Support & recovery

## 5.1 Export support bundle not possible
**Scenario**: export fails due to permissions/disk.

**User-facing behavior**
- Message: “Couldn’t create support bundle.”
- Actions:
  - **Try again**
  - **Choose another location**
  - **Copy diagnostics summary**

## 5.2 Reset app data
**Scenario**: user wants to start over.

**User-facing behavior**
- “Reset” is behind a confirmation dialog.
- Explain what will be removed:
  - tokens
  - configuration
  - local logs (optional)

**Acceptance criteria**
- Reset never uninstalls system-level dependencies without explicit user action.

---

# Appendix A — Copy guidelines (tone)
Use short, calm sentences.
- Prefer: “We couldn’t connect to Gmail.”
- Avoid: “Fatal error occurred.”

Include one clear next step.

# Appendix B — Acceptance checklist (global)
- Every integration card can represent: not connected / connecting / connected / attention needed.
- Every failure state offers at least one recovery action.
- Sensitive data is never shown in UI error messages.
