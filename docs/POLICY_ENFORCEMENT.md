# Policy Enforcement — openclaw-desktop

## Purpose
Define **how openclaw-desktop enforces “hard” safety and governance policies** across the desktop UI, the local manager API, and the running OpenClaw gateway.

This doc is intentionally **implementation-free**. It specifies what must be enforced, where enforcement must occur, how users experience it, and how to verify correctness.

---

## Scope
### In scope
- The policy classes openclaw-desktop exposes (confirmation, allowlists, scoped permissions).
- Enforcement layers and required “defense in depth”.
- Decision points for high-risk actions (send, write, delete, external post).
- Audit logging expectations for policy decisions (allow/deny/override).
- Failure behavior when policy evaluation cannot be performed.

### Out of scope
- Exact code-level middleware or plugin implementation details.
- Cryptographic signing details for updates (see `docs/UPDATE_STRATEGY.md`).
- Specific integration permission screens and copy (see `docs/ONBOARDING_COPY.md`).

---

## Definitions
- **Policy:** A deterministic rule that constrains what the system can do (e.g., “require confirmation before sending email”).
- **Hard policy:** A rule that must be enforced even if UI is compromised or misconfigured.
- **Soft policy:** A UI preference that improves UX but is not security-critical.
- **High-risk action:** An action that changes external state or transmits data externally (send message/email, post, create event, delete, file write outside app folder).
- **Principal / actor:** The initiating entity for an action (user via UI, agent via tool call, background job).
- **Target:** The external destination or object affected (recipient, channel, domain, calendar, file path).
- **Decision:** Policy evaluation outcome (ALLOW, DENY, REQUIRE_CONFIRMATION).

---

## Policy goals (non-negotiable)
1. **Defense in depth:** Never rely on a single layer (UI-only prompts are insufficient).
2. **Fail closed for high-risk actions:** If policy evaluation is unavailable, default to DENY (or REQUIRE_CONFIRMATION if explicitly supported).
3. **Explainability:** When blocked, users see *why* and how to fix it.
4. **Least privilege:** Default permissions are minimal; expansion requires explicit user opt-in.
5. **Tamper resistance (pragmatic):** Within a consumer desktop app, focus on preventing accidental misuse and reducing blast radius; do not promise perfect adversarial security.

---

## Policy model
Policies are represented in the **canonical app model** (see `docs/CONFIG_GENERATION.md`) and materialized into the gateway config. Policies are grouped by class.

### 1) Confirmation policies
Require a user confirmation step before a high-risk action executes.

**Examples:**
- Confirm before sending email
- Confirm before posting to a public channel
- Confirm before deleting calendar events
- Confirm before attaching files / uploading data

**Key parameters (conceptual):**
- action type (send/post/delete/write)
- integration/channel (Gmail, Slack, etc.)
- scope (all actions vs only external domains vs only new recipients)
- confirmation modality (inline dialog vs system-level prompt)

### 2) Allowlist / blocklist policies
Restrict destinations and/or operations.

**Examples:**
- Only allow sending to approved email addresses or domains
- Only allow messaging within a specific workspace/team
- Block sending to addresses not previously contacted

**Key parameters:**
- allowlist entries (exact address, domain, channel id)
- blocklist entries (optional)
- matching strategy (exact, suffix match for domains)
- normalization (case folding, punycode handling for domains)

### 3) Permission scope policies
Constrain what integrations can do at all.

**Examples:**
- Gmail: read-only vs read+send
- Calendar: read-only vs create events
- Messaging: read-only vs send

These should map to both:
- UI toggles (user intent)
- gateway/tool capability flags (enforcement)

### 4) Data-handling policies
Reduce sensitive data exposure.

**Examples:**
- Redact secrets in logs
- Restrict support bundle contents
- Limit retention of message history

(These overlap with diagnostics; detailed spec lives in `docs/SUPPORT_BUNDLE_SPEC.md`.)

---

## Enforcement layers (defense in depth)
Openclaw-desktop must enforce hard policies at **multiple layers**.

### Layer A — UI / UX enforcement (preventive)
The UI should prevent or discourage policy-violating requests early.

**Responsibilities:**
- Grey out / hide actions the user has not enabled.
- Show warnings when user composes an action that will require confirmation.
- Provide allowlist management UI with clear examples.

**Limitations:**
- UI is not authoritative; it can be bypassed by bugs, devtools, or compromised renderer.

### Layer B — Manager API enforcement (authoritative)
All high-risk operations that the UI initiates must pass through a **local manager API** that evaluates policies.

**Responsibilities:**
- Validate request schema and normalize targets.
- Evaluate policies using the canonical model.
- Return structured decision outcomes and required user-facing explanation.

**Rationale:**
- Keeps enforcement centralized and testable.
- Reduces risk of renderer compromise.

### Layer C — Gateway/tool enforcement (last line)
The OpenClaw gateway (and/or its plugins) must enforce the same hard constraints where possible.

**Responsibilities:**
- Refuse tool execution when policy flags disallow it.
- Require “confirmation tokens” for actions that need explicit approval.

**Rationale:**
- Protects against misbehaving agents, malformed requests, or UI bugs.

### Layer D — OS-level / boundary enforcement (optional)
Where feasible, leverage OS boundaries:
- keychain for secrets
- app sandboxing (where available)
- restricted file dialogs

---

## Policy decision flow (normative)
This describes the required flow for any **high-risk action**.

### Step 0 — Classify action
Manager classifies action as:
- **low-risk** (read-only, local UI state changes)
- **high-risk** (external state change or data egress)

Only high-risk actions require strict enforcement.

### Step 1 — Normalize + enrich
Normalize inputs into canonical forms:
- email addresses: trim, lowercase local/domain as appropriate, validate format
- domains: normalize IDN, strip trailing dots
- channels: canonical channel/user ids
- attachments: size, type, local file origin

Enrich request with:
- actor identity (UI user vs agent/tool)
- integration identity (which connected account)
- context summary (subject, recipient count, external domains)

### Step 2 — Evaluate policies
Evaluate in this order:
1. **Permission scope** (is the operation allowed at all?)
2. **Allowlist/blocklist** (is the target allowed?)
3. **Confirmation requirements** (is explicit approval needed?)

Produce a decision:
- **DENY** (must not proceed)
- **REQUIRE_CONFIRMATION** (must pause and request approval)
- **ALLOW** (may proceed)

### Step 3 — Execute with proof (when needed)
If decision is REQUIRE_CONFIRMATION:
- system must obtain explicit user approval *before* executing
- execution must include a proof of approval (see “Confirmation token”)

If ALLOW:
- execution may proceed without user prompt

If DENY:
- execution must not proceed

---

## Confirmation mechanism
Confirmation must be robust against replay and UI-only bypass.

### Confirmation UX (requirements)
The confirmation prompt must show:
- action type (Send email / Post message / Delete event)
- integration/account (e.g., `user@gmail.com`)
- targets (recipients/channels/domains)
- content summary (subject + first N characters; never show secrets)
- attachments summary (names + sizes)
- policy reason (“Confirm-before-send is enabled” / “Recipient is outside allowlist”)

Buttons:
- **Approve once**
- **Deny**
- Optional: **Approve + add to allowlist** (only if user explicitly enabled this convenience)

### Confirmation token (conceptual)
To prevent bypass, approvals should be represented as a short-lived token bound to:
- action hash (normalized recipients + content summary + attachments metadata)
- timestamp/expiry
- actor/device identity

The gateway/tool layer should require this token for execution when confirmation is required.

**Expiry:** short (e.g., minutes), single-use.

---

## Allowlist behavior
### Matching rules (normative)
- Exact address match has priority over domain match.
- Domain allowlist matches subdomains only if explicitly configured.
  - Example: allowing `example.com` does **not** automatically allow `sub.example.com` unless stated.
- Addresses are compared after normalization.

### Suggested UX
- Two sections: “Allowed email addresses” and “Allowed domains”.
- Provide examples and a “test a recipient” helper.

---

## Edge cases
### Policy evaluation unavailable
Examples:
- app state cannot be loaded
- corrupted policy config
- manager API not reachable

**Required behavior:**
- high-risk actions must **fail closed** (DENY) with actionable UI message.

### Multiple recipients / mixed allowlist results
- If any recipient is disallowed, default decision is **DENY** (or REQUIRE_CONFIRMATION only if policy explicitly permits “confirm to override allowlist”, which is generally discouraged).

### “New recipient” heuristic
If supporting “confirm only for new recipients”:
- define what counts as “known” (address seen in prior sends? contacts?)
- treat unknown as requiring confirmation
- do not auto-learn recipients without user consent

### Content too large to display
- Confirmation dialog should show a truncated preview with “View full” that remains local.

### Attachments
- Attachments substantially increase risk; policies may require confirmation even if recipient is allowlisted.
- Reject disallowed file types if configured.

### Time-of-check/time-of-use
- Ensure the approved action is the action executed (bind approval token to action hash).

### Offline mode
- If an action queues for later (future feature), confirmation must bind to the queued item and be re-validated at send time.

---

## Audit logging
Policy-related actions should be logged in a privacy-conscious manner.

### What to log (minimum)
- timestamp
- action type + integration
- decision (ALLOW/DENY/REQUIRE_CONFIRMATION)
- policy rules triggered (ids/names)
- normalized targets (redacted; e.g., domain only, or hashed recipient)
- user approval outcome (approved/denied)

### What NOT to log
- message bodies
- full recipient lists in plaintext (unless user explicitly enables verbose logging)
- secrets/tokens

### Storage/retention
- Keep logs local.
- Provide a retention setting (default conservative).

---

## Acceptance criteria
1. **Defense in depth:** High-risk actions are blocked even if the renderer/UI is bypassed.
2. **Fail closed:** When policy evaluation cannot run, high-risk actions do not execute.
3. **Confirmation integrity:** Confirm-required actions cannot execute without a valid, short-lived approval token bound to the request.
4. **Allowlist correctness:** Domain/address matching follows the documented normalization and precedence rules.
5. **Explainable outcomes:** Every DENY/REQUIRE_CONFIRMATION returns a user-facing explanation and next step.
6. **Auditable:** Policy decisions are logged with redaction and can be included in a support bundle under the redaction rules.

---

## Open questions
- Should allowlist violations ever be overridable via confirmation, or always hard-deny?
- What is the exact definition of “new recipient” (if supported), and where is the source of truth?
- Do we need separate policies for “agent-initiated” actions vs “user-initiated” actions?
- How should policy configuration changes be versioned/migrated (ties into `docs/CONFIG_GENERATION.md`)?
