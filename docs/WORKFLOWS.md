# Workflows — openclaw-desktop

## Doc-first development
1) Open an issue describing the user problem.
2) Update PRD/Architecture/API docs.
3) Only then start implementation.

## MVP workflow definitions
### First run
- detect/install manager
- start gateway
- connect Telegram

### Connect Gmail
- BYO Google OAuth creds
- consent screen
- store tokens
- enable plugin

### Permissions change
- UI toggles permission
- manager validates
- manager regenerates config
- restart gateway if necessary
- write audit event

### Turn Off
- stop gateway
- UI reflects stopped state

## Support workflow
- user clicks "Export support bundle"
- includes:
  - versions
  - diagnostics results
  - redacted logs
  - configuration (redacted)
