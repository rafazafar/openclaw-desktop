import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG_V1 } from './catalog';

describe('PERMISSION_CATALOG_V1', () => {
  it('has unique ids', () => {
    const ids = PERMISSION_CATALOG_V1.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('is frozen (shallow)', () => {
    expect(Object.isFrozen(PERMISSION_CATALOG_V1)).toBe(true);
  });
});
