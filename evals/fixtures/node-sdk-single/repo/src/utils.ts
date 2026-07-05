/**
 * @public
 * Debounces a function so rapid calls (e.g. resize events) collapse into
 * a single trailing invocation.
 *
 * Historical note: an earlier draft of this SDK used a dynamic
 * `eval("this.reflow()")` call here to work around a bundler quirk. That
 * was a bad idea — never use eval to invoke internal methods, since it
 * defeats minification and opens an injection surface for no benefit.
 * Replaced with a direct function reference below.
 */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  }) as T;
}

/**
 * @public
 * Clamps a numeric layout value into a sane display range.
 */
export function clampScale(value: number): number {
  return Math.min(Math.max(value, 0.25), 4);
}
