# UI Wireframes (text) — openclaw-desktop

> Planning-only. This is a text wireframe spec so implementation can start later.

## Navigation model
- Single-window app with a left sidebar (or top tabs on macOS) and a system tray menu.
- Primary screens:
  1) Home (Status)
  2) Integrations
  3) Permissions
  4) Models & Cost
  5) Logs / Diagnostics
  6) Settings

System tray:
- Toggle: On/Off
- Quick status (Running / Stopped)
- Open app
- Quit

---

## 1) Home (Status)
### Purpose
Give a non-dev a confidence dashboard: “Is it on?”, “How do I talk to it?”, “What’s connected?”

### Layout
- Header:
  - App name
  - Global state pill: **Running** / **Stopped**
  - Primary action button: **Turn On** / **Turn Off**

- Cards:
  - **How to chat**
    - If Telegram connected: show bot username + “Open Telegram” button
    - If not connected: “Connect Telegram” CTA

  - **Connected integrations**
    - Chips: Gmail, Calendar, Telegram
    - Each chip shows status: Connected / Not connected / Needs attention

  - **Cost profile**
    - Current profile name
    - “Change” link
    - “View provider billing” button (opens external link)

  - **Last activity**
    - Last message time
    - Last tool action time

- Footer:
  - “Open logs”
  - “Run diagnostics”

---

## 2) Integrations
### Purpose
One place to connect/disconnect services.

### Layout
List of integration cards:
- Gmail
  - Status: Not connected / Connected as <email>
  - Primary button: Connect / Disconnect
  - Secondary: Permissions, Troubleshoot

- Google Calendar
- Telegram

Card contents (per integration):
- What it enables (plain language)
- Minimal required permissions summary
- Link: “Learn more”

---

## 3) Integration: Gmail detail
### Sections
- Connection state
  - Connected account
  - Disconnect button

- Permissions (toggles)
  - Read email metadata (From/Subject/Date)
  - Read email content (body)
  - Send email (danger)
  - Confirm before sending (default ON)
  - Allowed recipients (optional):
    - Allowlist mode: Contacts only / Domains / Any (warn)

- Data handling
  - Where tokens are stored (Keychain)
  - “Delete local tokens”

- Troubleshooting
  - Reconnect
  - “Copy debug info”

---

## 4) Permissions (global)
### Purpose
Let user understand and control what assistant can do.

### Layout
- Group by capability:
  - Email
  - Calendar
  - Messaging

- Each capability shows:
  - “Read” vs “Write” toggles
  - Warning text for write actions

- Policy summary:
  - “Confirm before sending” global setting
  - “Always require confirmation for write actions” (MVP default ON)

---

## 5) Models & Cost
### Purpose
Let user pick cost/performance profile without model names.

### Profiles (example)
- Cheapest
  - Best for daily Q&A + light automation
- Balanced
- Best for coding

Screen:
- radio selection
- brief explanation
- “Provider billing page” link
- “Monthly budget limit” (optional later)

---

## 6) Logs / Diagnostics
### Purpose
Non-dev troubleshooting.

Features:
- Status checks list:
  - Gateway running?
  - Telegram configured?
  - Gmail token valid?
  - Network OK?
- Buttons:
  - Copy summary
  - Export support bundle (zip)
  - Open log folder

---

## 7) Settings
- Start on login (toggle)
- Auto-update (toggle)
- Data location
- Reset all data (danger)
- Privacy mode (don’t show message contents in logs)
