import { describe, expect, it } from 'vitest';
import { clampScale, debounce } from '../src/utils';

describe('clampScale', () => {
  it('clamps below the minimum', () => {
    expect(clampScale(0)).toBe(0.25);
  });

  it('clamps above the maximum', () => {
    expect(clampScale(10)).toBe(4);
  });

  it('passes through in-range values', () => {
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('debounce', () => {
  it('is a function that returns a function', () => {
    const fn = debounce(() => {}, 10);
    expect(typeof fn).toBe('function');
  });
});
