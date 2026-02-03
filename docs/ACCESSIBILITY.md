# Accessibility (a11y) — openclaw-desktop

## Purpose
Define baseline accessibility requirements so openclaw-desktop is usable with keyboard-only navigation, screen readers, and common OS-level accessibility features on **macOS** and **Windows**.

This is a planning/spec document (implementation-free) intended to prevent common a11y regressions and to guide UX copy, layout, and QA.

---

## Scope
### In scope (MVP)
- Primary screens (per `UI_WIREFRAMES.md`):
  - Home (Status)
  - Integrations list + per-integration detail (e.g., Gmail)
  - Permissions (global)
  - Models & Cost
  - Logs / Diagnostics
  - Settings
- System tray / menubar entry points (Open app, status, toggle).
- Common components:
  - Buttons, links, toggles/switches
  - Cards and lists
  - Dialogs/modals (confirmations, “danger” actions)
  - Forms (text fields, pickers, allowlist editors)
  - Toasts/alerts
  - Progress and loading states

### Out of scope (MVP)
- Full WCAG AA certification process.
- Advanced assistive tech matrices beyond mainstream screen readers.
- Multi-language support (when localization is added, revisit all copy + labels).

---

## Accessibility principles (product-level)
1) **Everything is operable without a mouse**.
2) **Everything has a programmatic name/role/state** (screen readers can understand it).
3) **No information conveyed by color alone**.
4) **Errors are clear, actionable, and announced**.
5) **Focus is predictable**; user never “loses” focus.
6) **Dangerous actions are guarded** with extra clarity and confirmation.

---

## User flows & a11y requirements

### Flow A — First run (basic setup)
**Goal:** User can complete setup (turn on gateway, connect Telegram, pick model profile) using keyboard and screen reader.

Requirements:
- Initial focus lands on the main heading or primary action (e.g., “Turn On”).
- Setup steps are presented as:
  - a clearly labeled ordered sequence (or stepper) OR
  - a single screen with clearly separated sections and headings.
- If opening an external browser for OAuth:
  - the app announces what will happen (“A browser window will open to sign in”) and provides a keyboard-focusable button.
  - when the user returns, focus moves to the next actionable item and a status message is announced.

Acceptance criteria:
- Keyboard-only users can finish first run without getting stuck.
- Screen reader users hear step context (e.g., “Step 2 of 3”).

---

### Flow B — Integrations: connect/disconnect
**Goal:** Integrations list is navigable, and each card communicates status and actions.

Requirements:
- Each integration card exposes:
  - name (e.g., “Gmail”)
  - connection status (Connected/Not connected/Needs attention)
  - primary action (Connect/Disconnect)
- Status must be readable as text, not only via icons.
- “Disconnect” is a clearly marked dangerous action and must require confirmation.

Acceptance criteria:
- A screen reader announces “Gmail, Connected as user@…, Disconnect button”.
- The user can tab through cards; focus order is logical and stable.

---

### Flow C — Permissions & consent
**Goal:** Permission toggles (read vs write) are clear and safe.

Requirements:
- Toggles must include explicit labels and descriptions:
  - Example: “Send email (write access)” and a warning description.
- If enabling a write permission:
  - present a confirmation dialog that is keyboard-operable and screen-reader announced.
  - default focus in the dialog should be on the safer option (e.g., “Cancel”).
- “Confirm before sending” (policy) must be described in plain language.

Acceptance criteria:
- Turning on/off any permission can be done via keyboard.
- Confirmation dialog traps focus and returns focus to the originating control when closed.

---

### Flow D — Logs / Diagnostics
**Goal:** Diagnostics results and errors are understandable and copyable.

Requirements:
- Diagnostics results are presented as a list with:
  - check name
  - status (Pass/Fail/Warning)
  - short explanation
  - “Fix” or “Troubleshoot” links where applicable
- Provide a single “Copy summary” button that copies a plain-text summary.
- For long logs:
  - provide search/filter
  - ensure text is selectable
  - ensure virtualized lists do not break screen reader navigation (if virtualization is used, verify SR behavior).

Acceptance criteria:
- Screen reader can navigate checks one-by-one and hear status + message.
- Copy summary works without relying on mouse.

---

## Component-level requirements

### Keyboard navigation
- All interactive elements must be reachable via Tab/Shift+Tab.
- Provide visible focus indicators with sufficient contrast.
- Support common shortcuts where appropriate:
  - Enter/Space activates buttons/toggles.
  - Esc closes dialogs.
  - Cmd/Ctrl+F opens search on log view (if present).
- Do not trap focus in non-modal UI.

### Focus management
- On navigation between screens:
  - set focus to the primary heading or first meaningful control.
- In modals/dialogs:
  - focus is moved into the dialog on open
  - focus is trapped inside
  - focus returns to the triggering element on close
- After async actions (connect/disconnect, restart gateway):
  - announce completion/failure via an ARIA-like live region equivalent in the UI framework.

### Labels, names, and descriptions
- Every interactive element has:
  - accessible name (“Connect Gmail”, not just “Connect”)
  - role (button, toggle, link)
  - current state when applicable (On/Off, Connected/Disconnected)
- Icon-only controls must have text alternatives.

### Color, contrast, and non-color cues
- Meet **WCAG 2.1 AA contrast** targets:
  - 4.5:1 for normal text
  - 3:1 for large text and UI glyphs
- Status indicators must include text (e.g., “Running”, “Stopped”, “Needs attention”) and not rely solely on color.

### Motion and timing
- Respect OS “Reduce motion” settings.
- Avoid animations that are essential to understanding.
- Avoid time-limited prompts; if timeouts exist (e.g., OAuth), provide clear retry paths.

### Forms and validation
- Inline validation messages must:
  - identify the field
  - explain what to do
  - be announced to screen readers
- Provide examples for complex inputs (e.g., recipient allowlists, domain patterns).

### Notifications and toasts
- Toasts must not be the only way to communicate outcomes.
- If toasts are used:
  - they must be announced
  - they must be dismissible
  - they must not steal focus unexpectedly

---

## Edge cases to handle
- **Gateway start fails:** error message includes next steps; focus moves to the error region.
- **OAuth cancelled / blocked:** app provides an accessible retry and explains the state.
- **Integration “Needs attention”:** the reason is presented in text with a clear call-to-action.
- **Restart required:** when a toggle requires restart, show a clear prompt and avoid surprise restarts.
- **High contrast mode (Windows):** UI remains usable and readable.
- **System font scaling:** layouts do not clip essential content at common scaling levels.

---

## QA checklist (acceptance criteria)
### Keyboard-only
- [ ] Can reach every control in every screen via Tab.
- [ ] Focus ring is always visible and not clipped.
- [ ] Can open/close dialogs via keyboard.
- [ ] Can activate primary flows (On/Off, Connect, Disconnect, Export support bundle).

### Screen reader (baseline)
- [ ] Headings are meaningful and used for structure.
- [ ] Buttons have unique, descriptive names.
- [ ] Toggles announce state changes.
- [ ] Errors and success messages are announced.

### Visual
- [ ] Contrast meets WCAG AA for text and key UI affordances.
- [ ] Status is not color-only.

### Documentation outcome
- If any item fails, log it as a bug and note the affected screen/component.
