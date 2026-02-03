export type PermissionRisk = 'low' | 'medium' | 'high';

export type PermissionGroup =
  | 'gateway'
  | 'integrations'
  | 'messaging'
  | 'email'
  | 'calendar'
  | 'diagnostics'
  | 'support';

export interface PermissionDef {
  /** Stable, machine-readable id. Never reuse ids for different meaning. */
  id: PermissionId;
  /** Human readable name for UI. */
  title: string;
  /** Human readable help text for UI. */
  description: string;
  /** Used for grouping in UI and logs. */
  group: PermissionGroup;
  /** Rough risk level (used for warnings / extra confirms in UI). */
  risk: PermissionRisk;
  /** Whether the permission is enabled by default (should almost always be false). */
  defaultEnabled: boolean;
}

/**
 * Permission ids for openclaw-desktop.
 *
 * Note: Keep this list intentionally small in v1.
 * Add new permissions as needed rather than overfitting early.
 */
export type PermissionId =
  // Gateway lifecycle
  | 'gateway.control'

  // Integrations: connect/disconnect (token/OAuth flows)
  | 'integrations.telegram.manage'
  | 'integrations.gmail.manage'
  | 'integrations.calendar.manage'

  // Data access
  | 'gmail.read'
  | 'calendar.read'

  // High-risk actions (data egress / external side effects)
  | 'telegram.send'
  | 'gmail.send'
  | 'calendar.write'

  // Local tooling
  | 'diagnostics.run'
  | 'support.export';

export const PERMISSION_CATALOG_V1: ReadonlyArray<PermissionDef> = Object.freeze([
  {
    id: 'gateway.control',
    title: 'Control OpenClaw Gateway',
    description: 'Start, stop, or restart the local OpenClaw gateway process.',
    group: 'gateway',
    risk: 'medium',
    defaultEnabled: true
  },
  {
    id: 'integrations.telegram.manage',
    title: 'Connect Telegram',
    description: 'Add or remove a Telegram bot token for OpenClaw to use.',
    group: 'integrations',
    risk: 'medium',
    defaultEnabled: false
  },
  {
    id: 'telegram.send',
    title: 'Send Telegram messages',
    description: 'Allow OpenClaw to send messages to Telegram chats.',
    group: 'messaging',
    risk: 'high',
    defaultEnabled: false
  },
  {
    id: 'integrations.gmail.manage',
    title: 'Connect Gmail',
    description: 'Connect Gmail via OAuth and manage stored credentials.',
    group: 'integrations',
    risk: 'medium',
    defaultEnabled: false
  },
  {
    id: 'gmail.read',
    title: 'Read Gmail',
    description: 'Allow OpenClaw to read your email (metadata and/or content based on configuration).',
    group: 'email',
    risk: 'medium',
    defaultEnabled: false
  },
  {
    id: 'gmail.send',
    title: 'Send email via Gmail',
    description: 'Allow OpenClaw to send email from your Gmail account.',
    group: 'email',
    risk: 'high',
    defaultEnabled: false
  },
  {
    id: 'integrations.calendar.manage',
    title: 'Connect Calendar',
    description: 'Connect a calendar account and manage stored credentials.',
    group: 'integrations',
    risk: 'medium',
    defaultEnabled: false
  },
  {
    id: 'calendar.read',
    title: 'Read calendar',
    description: 'Allow OpenClaw to read calendar events.',
    group: 'calendar',
    risk: 'medium',
    defaultEnabled: false
  },
  {
    id: 'calendar.write',
    title: 'Create or edit calendar events',
    description: 'Allow OpenClaw to create or modify calendar events.',
    group: 'calendar',
    risk: 'high',
    defaultEnabled: false
  },
  {
    id: 'diagnostics.run',
    title: 'Run diagnostics',
    description: 'Allow the app to run local diagnostics (no secrets included).',
    group: 'diagnostics',
    risk: 'low',
    defaultEnabled: true
  },
  {
    id: 'support.export',
    title: 'Export support bundle',
    description: 'Allow exporting a local support bundle (redacted) for troubleshooting.',
    group: 'support',
    risk: 'medium',
    defaultEnabled: false
  }
]);

export const permissionCatalogById: ReadonlyMap<PermissionId, PermissionDef> =
  new Map(PERMISSION_CATALOG_V1.map((p) => [p.id, p]));

export function getPermissionDef(id: PermissionId): PermissionDef {
  const def = permissionCatalogById.get(id);
  if (!def) {
    // Should be impossible unless the catalog is modified incorrectly.
    throw new Error(`Unknown permission id: ${id}`);
  }
  return def;
}
