# Distribution & Packaging — openclaw-desktop

## Targets
- macOS (signed + notarized)
- Windows (signed installer)
- Linux (later)

## Packaging approach
### Option A: Bundle OpenClaw
- Ship OpenClaw CLI/gateway with the app.
- Pros: predictable compatibility
- Cons: larger downloads, slower to update

### Option B: Download OpenClaw on first run
- Manager downloads a pinned version.
- Pros: smaller app
- Cons: more moving parts, network failures

MVP recommendation: **Option A**.

## Start/Stop UX
- Background manager runs on demand.
- "On" starts gateway.
- Tray provides quick toggle.

## Auto-update
- Desktop app: standard updater (framework dependent)
- OpenClaw: update only via app updates for MVP

## Telemetry
- default OFF
- if enabled later: crash reports only, no content
