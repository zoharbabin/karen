import { describe, it, expect, beforeEach } from 'vitest';
import { register, exportDataSubject, eraseDataSubject } from '../src/consent/registry';

describe('consent registry', () => {
  beforeEach(() => {
    // registry module holds module-level state; each test registers its own store
  });

  it('fans export out to every registered store', async () => {
    let exported = false;
    register({
      name: 'testStore',
      exportUser: async () => {
        exported = true;
        return { field: 'value' };
      },
      eraseUser: async () => {},
    });
    const result = await exportDataSubject('tenant1', 'user1');
    expect(exported).toBe(true);
    expect(result.testStore).toEqual({ field: 'value' });
  });

  it('fans erasure out to every registered store', async () => {
    let erased = false;
    register({
      name: 'eraseStore',
      exportUser: async () => ({}),
      eraseUser: async () => {
        erased = true;
      },
    });
    await eraseDataSubject('tenant1', 'user1');
    expect(erased).toBe(true);
  });
});
