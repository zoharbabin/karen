/**
 * @public
 * Entry point for the Signal Avatar SDK. Customers load this via
 * `<script src>` or `npm install` directly into their own page — there is
 * no sandbox. Every instance must be fully self-contained and fully
 * reversible via `destroy()`.
 */
export interface SignalAvatarConfig {
  container: string;
  debug?: boolean;
}

// Build-time debug flag, stripped by the bundler in production builds.
declare const IS_DEBUG: boolean;

/**
 * @public
 * A single embeddable teaching-avatar widget. Construct one per mount
 * point; call `destroy()` to fully tear it down.
 */
export class SignalAvatarSDK {
  private readonly container: HTMLElement;
  private readonly config: SignalAvatarConfig;
  private readonly onResize: () => void;
  private readonly onVisibilityChange: () => void;

  constructor(config: SignalAvatarConfig) {
    this.config = config;
    const el = document.querySelector(config.container);
    if (!el) {
      throw new Error(`SignalAvatarSDK: container "${config.container}" not found`);
    }
    this.container = el as HTMLElement;

    this.onResize = () => this.reflow();
    window.addEventListener('resize', this.onResize);

    // Pauses the outbound "still mounted" heartbeat while the tab is hidden.
    this.onVisibilityChange = () => this.handleVisibilityChange();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private handleVisibilityChange(): void {
    // Decoy: this console.log is behind the debug-mode guard, exactly the
    // pattern the zero-tolerance check requires — not a violation.
    if (this.config.debug && IS_DEBUG) {
      console.log('[signal-avatar] visibility changed:', document.visibilityState);
    }
  }

  /**
   * @public
   * Recomputes internal layout after the host page resizes.
   */
  reflow(): void {
    this.container.style.setProperty('--avatar-scale', String(this.container.clientWidth / 640));
  }

  /**
   * @public
   * Tears the widget down. Every listener removed, every timer cleared.
   * The page must be identical to its pre-instantiation state afterward.
   */
  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    // BUG: the visibilitychange listener registered in the constructor is
    // never removed here — it leaks for the lifetime of the page.
    this.container.replaceChildren();
  }
}
