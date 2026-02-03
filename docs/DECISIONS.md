# Decisions — openclaw-desktop

This file records small, practical decisions made during MVP implementation.

## 2026-02-04 — Desktop framework: Electron

**Decision:** Use **Electron** for the desktop app skeleton (M1).

**Why (MVP constraints):**
- Runs well on Windows (primary dev environment) and can be packaged later.
- Minimal “hello world” window is straightforward without committing to a heavy UI stack.
- Easy to iterate on manager API wiring (HTTP on localhost) with simple renderer code.

**Notes:**
- Keep renderer simple (plain HTML/JS) until we need a real UI framework.
- Keep security defaults (no Node integration in renderer; use preload/contextBridge for API access).
