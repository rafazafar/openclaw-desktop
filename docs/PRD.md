# PRD — openclaw-desktop

## 1. Summary
**openclaw-desktop** is a consumer-friendly desktop application that runs and manages OpenClaw locally, exposing a simple UI to:
- start/stop the OpenClaw gateway
- connect integrations (Gmail, Google Calendar, Telegram, etc.) via guided onboarding
- manage permissions (“capabilities + consent”) in plain language
- show health/status and troubleshooting info

This project aims to make OpenClaw usable by non-developers, similar to Claude Desktop / ChatGPT Desktop.

---

## 2. Problem
OpenClaw is powerful, but the current setup experience is developer-centric:
- configuration is file/CLI driven
- integrations require manual credential management
- users lack a clear mental model of what the assistant can access/do

Non-dev users want:
- “turn it on/off”
- “connect my Gmail”
- “allow sending emails”
- “disconnect anytime”
- predictable costs and safety

---

## 3. Target users
### Primary
- Non-developers who want a local personal assistant with integrations.

### Secondary
- Power users/devs who want a GUI manager instead of editing config.

---

## 4. Goals (MVP)
### 4.1. Desktop UX
- A **single window** with:
  - **On/Off** (gateway running status)
  - Integration cards: Gmail, Calendar, Telegram (initial set)
  - “Connected account” state + Disconnect
  - Basic logs/status

### 4.2. Guided onboarding
- “Connect Gmail” triggers an OAuth flow (browser-based) and results in:
  - tokens stored securely
  - OpenClaw configured to use the integration
  - explicit permission summary shown to the user

### 4.3. Permissions + consent
- Display permissions in clear language, e.g.
  - Gmail: “Read email subject/sender/date”
  - Gmail: “Send email on your behalf” (separate toggle)
- Revocation:
  - per-integration disconnect
  - local token deletion

### 4.4. Cost controls (MVP)
- Provide 2–3 **model profiles** with plain explanations:
  - “Cheapest” (default)
  - “Balanced”
  - “Best for coding”
- Show an estimate disclaimer, and link to provider billing pages.

---

## 5. Non-goals (MVP)
- Building a new LLM engine.
- Forking OpenClaw.
- Building a full chat client UI (we can start as “manager app”; chat stays in Telegram or existing channel).
- Supporting every integration from day 1.

---

## 6. Key flows
### 6.1. First run
1. User installs openclaw-desktop.
2. App checks prerequisites (network, permissions).
3. App starts local OpenClaw gateway (bundled or downloaded).
4. User chooses a “model profile”.
5. User connects at least one channel (Telegram) to talk to the assistant.

### 6.2. Connect Gmail
1. Click “Connect Gmail”.
2. App opens browser to Google OAuth consent.
3. Redirect returns to local callback.
4. Tokens stored in keychain.
5. App enables Gmail integration in OpenClaw and restarts/reloads.
6. UI shows “Connected: user@gmail.com”.

### 6.3. Disable / uninstall
- Turning off stops the gateway.
- Disconnect removes tokens.
- Uninstall offers “delete all local data” option.

---

## 7. Requirements
### Functional
- Start/stop/restart OpenClaw
- Configure integrations without manual file editing
- Secure token storage
- Status, errors, and basic logs

### Non-functional
- OS: macOS + Windows first (Linux later)
- Safe defaults; minimal user confusion
- Clear “what data is accessed” messaging

---

## 8. Success metrics
- Setup time to “assistant responding in Telegram”: < 10 minutes
- % of users completing at least 1 integration connection
- Reduction in support questions about config/credentials

---

## 9. Risks
- OAuth implementation complexity and compliance
- Securing local management API and tokens
- Model/provider cost variance
- Upstream OpenClaw changes

---

## 10. Open questions
See `docs/OPEN_QUESTIONS.md`.
