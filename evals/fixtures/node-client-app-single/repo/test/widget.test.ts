import { describe, it, expect } from 'vitest';
import { ChatWidget } from '../src/widget.js';

describe('ChatWidget', () => {
  it('mounts into the given container and tears down on destroy()', () => {
    const root = document.createElement('div');
    root.id = 'chat-widget-root';
    document.body.appendChild(root);

    const widget = new ChatWidget({ container: '#chat-widget-root' });
    widget.destroy();

    expect(root.childElementCount).toBe(0);
  });
});
