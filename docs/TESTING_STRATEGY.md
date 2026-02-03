# Testing Strategy — openclaw-desktop

## Goals
- Prevent regressions in onboarding flows
- Ensure security properties (no token leakage)
- Ensure start/stop reliability

## Layers
1) Unit tests
- config generation
- permission mapping
- state migrations

2) Integration tests
- manager API endpoints
- fake OAuth server + token storage
- OpenClaw process lifecycle (mocked/real in CI where possible)

3) E2E tests
- UI automation for main flows:
  - first run
  - connect Telegram (manual)
  - connect Gmail (mock OAuth)

## Security tests
- ensure manager API rejects missing/invalid token
- ensure localhost-only binding
- ensure support bundle redacts secrets

## CI
- run unit + integration tests on PR
- nightly E2E optional
