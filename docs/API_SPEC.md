# Local Manager API Spec (draft) — openclaw-desktop

## Overview
The desktop UI talks to a local manager service over HTTP on `127.0.0.1`.

Goals:
- stable contract for UI
- hides OpenClaw config complexity
- manages secrets and OAuth

Non-goals:
- remote access
- public network exposure

---

## Transport
- Base URL: `http://127.0.0.1:<port>`
- Port: dynamic on install OR fixed (TBD)
- Auth: `Authorization: Bearer <local_api_token>`
- Content-Type: `application/json`

### Auth bootstrap
Manager generates a random token on install/first run and stores it in OS keychain.
UI retrieves it via local IPC or secure file with ACL.

---

## Common types
### GatewayState
- `status`: `stopped | starting | running | stopping | error`
- `pid?: number`
- `version?: string`
- `lastError?: { message: string; code?: string; details?: string }`

### Integration
- `id`: `gmail | gcal | telegram | ...`
- `displayName`
- `connected`: boolean
- `accountLabel?: string` (e.g. email)
- `needsAttention?: boolean`
- `capabilities`: string[] (internal)

### Permission
- `id`: string
- `title`: string
- `description`: string
- `level`: `read | write | admin`
- `enabled`: boolean
- `dangerous`: boolean

---

## Endpoints

### Status
#### GET /status
Returns:
- `gateway: GatewayState`
- `integrations: Integration[]`
- `permissions: Permission[]`
- `diagnostics: { checks: Array<{ id: string; ok: boolean; message: string }> }`

---

### Gateway control
#### POST /gateway/start
Body: `{}`

#### POST /gateway/stop
Body: `{}`

#### POST /gateway/restart
Body: `{}`

---

### Integrations
#### GET /integrations
Returns `{ integrations: Integration[] }`

#### POST /integrations/:id/connect
Starts connection.

For OAuth integrations, returns:
- `{ kind: "oauth", authUrl: string, callbackUrl: string }`

For token/manual integrations (Telegram), returns:
- `{ kind: "manual", fields: Array<{ name: string; label: string; secret: boolean }> }`

#### POST /integrations/:id/submit
Completes manual flows.
Body example for Telegram:
```json
{ "botToken": "123:abc" }
```

#### POST /integrations/:id/disconnect
Revokes local tokens and disables integration.

---

### Permissions
#### GET /permissions
Returns `{ permissions: Permission[] }`

#### POST /permissions
Body:
```json
{ "set": [{ "id": "gmail.send", "enabled": true }] }
```

---

### Models & Cost profile
#### GET /models/profile
Returns `{ profileId: string, displayName: string }`

#### POST /models/profile
Body: `{ "profileId": "cheapest" }`

---

### Diagnostics
#### POST /diagnostics/run
Returns results for checks.

#### POST /diagnostics/export
Returns `{ path: string }` to a support bundle zip.

---

## Error format
All errors return:
```json
{ "error": { "message": "...", "code": "...", "details": "..." } }
```

---

## Security notes
- bind to localhost only
- reject non-localhost Host headers
- CSRF: require Authorization header and disallow cookies
- rate limit potentially dangerous endpoints
- audit log for permission changes and send actions
