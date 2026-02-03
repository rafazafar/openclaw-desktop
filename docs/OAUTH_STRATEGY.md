# OAuth strategy — openclaw-desktop

## Problem
Google OAuth is necessary for Gmail/Calendar integrations, but production OAuth apps may require verification.

## Recommended MVP approach: BYO client credentials
To avoid verification blockers initially:
- User creates their own Google Cloud project
- Enables Gmail/Calendar APIs
- Creates OAuth client (Desktop or Web depending on callback strategy)
- Pastes Client ID/Secret into openclaw-desktop

Pros:
- avoids shared client verification
- faster to ship

Cons:
- more steps for non-devs

## Later: managed shared client
Once traction is proven, operate a shared OAuth client:
- requires compliance work
- better UX

## Flow
- Use system browser
- Callback options:
  1) localhost callback to manager (preferred)
  2) device code flow (if supported)

Token handling:
- store refresh tokens in OS keychain
- validate tokens periodically
- allow revoke

## Scopes
MVP start minimal:
- Gmail read metadata only
- Expand only with explicit toggle and re-consent

## Re-consent
When enabling a new permission that requires additional scopes:
- show what changes
- re-run OAuth consent
