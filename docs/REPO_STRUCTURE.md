# Repo Structure — openclaw-desktop

## Proposed layout (when implementation starts)

```
openclaw-desktop/
  apps/
    desktop/          # Electron/Tauri UI
    manager/          # Local manager service (clawctl)
  packages/
    core/             # shared types, state model
    integrations/     # integration definitions (gmail, gcal, telegram)
    policy/           # permission/policy enforcement
  docs/               # PRDs/specs (this folder)
  scripts/            # build/release automation
```

## Documentation-first workflow
- Any major feature begins with a PR updating docs:
  - PRD delta
  - API spec changes
  - security considerations

## Public issues
- Use GitHub Issues with labels:
  - `area:ui`, `area:manager`, `area:integrations`, `area:security`
  - `type:prd`, `type:bug`, `type:enhancement`
