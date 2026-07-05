import { describe, it, expect, beforeEach } from 'vitest';
import { TeachingAvatarSDK } from '../src/sdk';

describe('TeachingAvatarSDK', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="lesson-avatar"></div>';
  });

  it('mounts into the given container', () => {
    const sdk = new TeachingAvatarSDK({ container: '#lesson-avatar' });
    expect(sdk).toBeInstanceOf(TeachingAvatarSDK);
    sdk.destroy();
  });

  it('destroy() empties the container', () => {
    const sdk = new TeachingAvatarSDK({ container: '#lesson-avatar' });
    sdk.destroy();
    expect(document.querySelector('#lesson-avatar')?.childNodes.length).toBe(0);
  });
});
