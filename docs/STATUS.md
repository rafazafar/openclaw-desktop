# Docs Status — openclaw-desktop

This file is used by the recurring cron job to continue planning work without losing context.

## Rule
- When you finish a doc, mark it ✅ and add the completion date.
- If you start a doc but don’t finish, mark it 🚧 and leave a short note.
- If you decide a doc is unnecessary, mark it ❌ with rationale.

---

## Completed (✅)
- ✅ PRD.md (2026-02-04)
- ✅ ARCHITECTURE.md (2026-02-04)
- ✅ INTEGRATIONS.md (2026-02-04)
- ✅ PERMISSIONS.md (2026-02-04)
- ✅ ROADMAP.md (2026-02-04)
- ✅ OPEN_QUESTIONS.md (2026-02-04)
- ✅ UI_WIREFRAMES.md (2026-02-04)
- ✅ API_SPEC.md (2026-02-04)
- ✅ DATA_MODEL.md (2026-02-04)
- ✅ SECURITY_THREAT_MODEL.md (2026-02-04)
- ✅ OAUTH_STRATEGY.md (2026-02-04)
- ✅ DISTRIBUTION_PACKAGING.md (2026-02-04)
- ✅ TESTING_STRATEGY.md (2026-02-04)
- ✅ REPO_STRUCTURE.md (2026-02-04)
- ✅ WORKFLOWS.md (2026-02-04)
- ✅ GLOSSARY.md (2026-02-04)
- ✅ MILESTONES.md (2026-02-04)

---

## Planned backlog (not started)
These are optional but useful PRD-adjacent docs to make later implementation smoother.

### Product / UX
- ✅ ONBOARDING_COPY.md (2026-02-04) — exact user-facing text for flows (first run, connect Gmail, permissions warnings)
- ✅ UX_EDGE_CASES.md (2026-02-04) — edge cases + error states (invalid token, revoked OAuth, network blocked)
- ✅ ACCESSIBILITY.md (2026-02-04) — basic a11y requirements

### Engineering
- ✅ CONFIG_GENERATION.md (2026-02-04) — how manager generates OpenClaw config, ownership strategy, migration approach
- ✅ POLICY_ENFORCEMENT.md (2026-02-04) — how “hard” policies are enforced (confirm-before-send, allowlists)
- ✅ UPDATE_STRATEGY.md (2026-02-04) — detailed update mechanisms, signing, rollback
- ✅ SUPPORT_BUNDLE_SPEC.md (2026-02-04) — exactly what diagnostics include + redaction rules

### Project management
- ✅ BACKLOG.md (2026-02-04) — prioritized issues list derived from PRD/roadmap
- ⬜ DECISIONS.md — ADR-style decisions (Electron vs Tauri, bundling strategy)

---

## Next task (picked up by cron)
1) Create missing backlog docs in sensible order:
   - DECISIONS.md
2) Update this file after each doc.
3) Commit directly to `master` and push.

