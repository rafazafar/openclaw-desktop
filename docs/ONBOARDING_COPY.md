# Onboarding Copy — openclaw-desktop

Purpose: provide **ready-to-use user-facing text** for the MVP onboarding and integration connection flows.

Scope:
- First run / setup wizard
- Connect channel (Telegram) / “how to talk to your assistant”
- Connect Gmail (OAuth) + permission explanations
- Permissions & consent warnings (send-on-your-behalf, data access)
- Disconnect / revoke / uninstall prompts

Non-scope:
- UI layout (see `UI_WIREFRAMES.md`)
- Technical implementation details (callbacks, token storage)

---

## Voice & style
- Clear, calm, non-technical.
- Prefer concrete verbs (“Connect”, “Disconnect”, “Open browser”).
- Avoid fear-based language; be explicit about control and revocation.
- Use consistent terms:
  - **OpenClaw** = the local assistant service.
  - **Gateway** = the local background service that runs OpenClaw.
  - **Integration** = Gmail/Calendar/etc.
  - **Channel** = where you chat with the assistant (Telegram, etc.).

---

## First run (setup wizard)

### Screen: Welcome
- **Title:** Welcome to OpenClaw Desktop
- **Body:**
  - “OpenClaw runs on your computer and can connect to services you choose (like Gmail).”
  - “You stay in control: you can disconnect any integration at any time.”
- **Primary button:** Get started
- **Secondary button:** Learn more
  - Link label: “What is OpenClaw?”

### Screen: What this app does
- **Title:** What OpenClaw Desktop manages
- **Body (bullets):**
  - “Start/stop OpenClaw on this device”
  - “Connect integrations (Gmail, Calendar, Telegram…)”
  - “Show what OpenClaw can access, and let you change it”
- **Primary button:** Continue
- **Secondary button:** Back

### Screen: Start the gateway
- **Title:** Start OpenClaw
- **Body:** “OpenClaw needs to run in the background for your assistant to work.”
- **Callout (small text):** “You can turn this off anytime from the main screen.”
- **Primary button:** Start OpenClaw
- **Secondary button:** Not now

### Screen: Model profile
- **Title:** Choose a model profile
- **Body:** “This changes cost, speed, and quality. You can switch later.”
- **Options:**
  - **Cheapest (recommended):** “Lower cost, good for everyday tasks.”
  - **Balanced:** “A solid default for most people.”
  - **Best for coding:** “Better for programming and long, detailed answers.”
- **Footnote (small text):** “Your model provider may charge usage fees separately.”
- **Primary button:** Continue
- **Secondary button:** Back

### Screen: Choose a channel (how you’ll chat)
- **Title:** Where do you want to chat with your assistant?
- **Body:** “OpenClaw Desktop is a manager app. You’ll chat in a connected channel.”
- **Options (MVP):**
  - **Telegram:** “Chat with your assistant from Telegram.”
- **Primary button:** Connect Telegram
- **Secondary button:** Skip for now

### Screen: Setup complete
- **Title:** You’re ready
- **Body:** “OpenClaw is running. Connect an integration anytime from the main screen.”
- **Primary button:** Go to dashboard

---

## Dashboard / global status copy

### Gateway status chip
- **Running:** “OpenClaw is on”
- **Stopped:** “OpenClaw is off”
- **Starting:** “Starting…”
- **Stopping:** “Stopping…”

### Empty state (no integrations connected)
- **Title:** Connect your first integration
- **Body:** “Add Gmail or Calendar so your assistant can help with real tasks.”
- **Primary button:** Connect Gmail
- **Secondary button:** Connect Calendar

---

## Connect Telegram (channel)

### Card (not connected)
- **Title:** Telegram
- **Subtitle:** “Chat with your assistant in Telegram.”
- **Primary button:** Connect

### Flow: instructions screen
- **Title:** Connect Telegram
- **Body (steps):**
  1) “We’ll open Telegram to start a chat with your assistant.”
  2) “Send a message like: ‘Hi’ to verify it’s working.”
- **Primary button:** Open Telegram
- **Secondary button:** I’ll do this later

### Success toast
- “Telegram connected.”

### Failure toast (generic)
- “Couldn’t connect Telegram. Check your internet connection and try again.”

---

## Connect Gmail (OAuth)

### Card (not connected)
- **Title:** Gmail
- **Subtitle:** “Let your assistant read and (optionally) send email.”
- **Primary button:** Connect

### Pre-consent screen
- **Title:** Connect Gmail
- **Body:**
  - “You’ll sign in with Google in your browser.”
  - “OpenClaw Desktop will store your access securely on this device.”
- **Permissions preview (bullets):**
  - “Read email metadata (from, subject, date)”
  - “Read email content when needed for a task”
  - “Send email **only if you enable sending**”
- **Primary button:** Continue to Google
- **Secondary button:** Cancel

### Browser handoff hint (banner)
- “Your browser will open to Google. After you approve, you’ll come back here automatically.”

### In-progress screen
- **Title:** Waiting for Google…
- **Body:** “Finish signing in in your browser.”
- **Secondary button:** Cancel

### Success screen
- **Title:** Gmail connected
- **Body:** “Signed in as {emailAddress}.”
- **Primary button:** Done

### Failure screen (OAuth cancelled)
- **Title:** Gmail connection cancelled
- **Body:** “No changes were made.”
- **Primary button:** Try again
- **Secondary button:** Close

### Failure screen (OAuth error)
- **Title:** Couldn’t connect Gmail
- **Body:** “Google returned an error. Please try again.”
- **Details (collapsed):** “Error code: {code}”
- **Primary button:** Try again
- **Secondary button:** View troubleshooting

---

## Permissions & consent copy (Gmail)

### Section header
- “What your assistant can do with Gmail”

### Read access toggle
- **Label:** Allow reading email
- **Help text:** “Lets your assistant search and read emails to complete tasks.”

### Send access toggle (separate consent)
- **Label:** Allow sending email
- **Help text:** “Lets your assistant send email from your account.”

### Send access warning modal
- **Title:** Allow sending email?
- **Body:**
  - “With this enabled, OpenClaw can draft and send email from {emailAddress}.”
  - “We recommend keeping this off unless you need it.”
  - “You can require confirmation before sending in Settings.”
- **Primary button:** Allow sending
- **Secondary button:** Keep off

### Confirmation-before-send setting (if present)
- **Label:** Require confirmation before sending
- **Help text:** “You’ll review the recipient and message before anything is sent.”

### Permissions summary line items (used in UI)
- “Read: sender, subject, date”
- “Read: message content (when needed)”
- “Send: email on your behalf”

---

## Disconnect / revoke copy

### Disconnect button label
- “Disconnect”

### Disconnect confirmation modal (generic)
- **Title:** Disconnect {integrationName}?
- **Body:**
  - “This removes the saved connection from this device.”
  - “Your assistant will stop using {integrationName} immediately.”
- **Primary button:** Disconnect
- **Secondary button:** Cancel

### Disconnect confirmation modal (Gmail-specific)
- **Title:** Disconnect Gmail?
- **Body (bullets):**
  - “We’ll delete saved Gmail access from this device.”
  - “Emails won’t be accessible to your assistant.”
  - “You may also revoke access from your Google Account security settings.”
- **Primary button:** Disconnect Gmail
- **Secondary button:** Cancel

### Post-disconnect toast
- “Disconnected.”

---

## Uninstall / remove local data copy

### Uninstall prompt (in-app, optional)
- **Title:** Remove OpenClaw data?
- **Body:** “Choose what to remove from this device.”
- **Options:**
  - **Keep data:** “Keep your settings and connections.”
  - **Delete local data (recommended when uninstalling):** “Removes settings, tokens, and logs from this device.”
- **Primary button:** Continue
- **Secondary button:** Cancel

### Delete local data confirmation
- **Title:** Delete local data?
- **Body:**
  - “This will remove saved connections and local settings.”
  - “You can reconnect integrations later.”
- **Primary button:** Delete data
- **Secondary button:** Cancel

---

## Edge-case microcopy (short)

### Network offline banner
- “You’re offline. Some connections may not work.”

### Gateway stopped banner
- “OpenClaw is off. Start it to use your assistant.”

### Generic retry
- Button label: “Try again”

### Generic support link label
- “View troubleshooting”

---

## Acceptance criteria
- Copy covers the core MVP flows: first run, connect Telegram, connect Gmail, permissions warnings, disconnect.
- Text is implementation-free (no API endpoints, no storage mechanism specifics beyond “securely on this device”).
- All user-visible strings include consistent terms (OpenClaw, integration, channel).
- Includes separate consent language for **send-on-your-behalf**.
