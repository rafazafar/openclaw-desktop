# Open Questions — openclaw-desktop

## Product
1) Is the desktop app just a **manager** (preferred MVP), or also a full **chat UI**?
2) Should “On/Off” mean:
   - gateway process running
   - or all integrations disabled
   - or both?

## Technical
3) Electron vs Tauri?
   - Electron: fastest ecosystem, heavier
   - Tauri: lighter, Rust complexity
4) How should the manager start OpenClaw?
   - call OpenClaw CLI
   - or manage process directly
5) How do we store secrets and present them to OpenClaw?
   - env injection
   - local file with ACL
   - manager-mediated token exchange

## Security / Permissions
6) Where is policy enforced?
   - “soft” (prompt only)
   - “hard” (manager refuses disallowed actions)
7) For “send email” should we require:
   - always confirm
   - allow user-defined trust rules

## OAuth / Compliance
8) Google OAuth verification risk:
   - Can we ship with “bring your own Google Cloud project” initially?
   - Or do we operate a shared client id (harder)?

## Distribution
9) Do we bundle OpenClaw binaries or download on first run?
10) How do we handle OpenClaw updates and compatibility?
