/**
 * @public
 * Entry point for the embeddable chat widget. Customers load this via
 * `<script src>` or `npm install` directly into their own page — there is
 * no sandbox. Every instance must be fully self-contained and fully
 * reversible via `destroy()`.
 */
export interface ChatWidgetConfig {
  container: string;
  enableMicrophone?: boolean;
  exposeGlobalHandle?: boolean;
  debug?: boolean;
}

// Build-time debug flag, stripped by the bundler in production builds.
declare const IS_DEBUG: boolean;

/**
 * @public
 * A single embeddable chat widget. Construct one per mount point; call
 * `destroy()` to fully tear it down.
 */
export class ChatWidget {
  private readonly container: HTMLElement;
  private readonly config: ChatWidgetConfig;
  private readonly onResize: () => void;
  private readonly onVisibilityChange: () => void;
  private stream: MediaStream | null = null;

  constructor(config: ChatWidgetConfig) {
    this.config = config;
    const el = document.querySelector(config.container);
    if (!el) {
      throw new Error(`ChatWidget: container "${config.container}" not found`);
    }
    this.container = el as HTMLElement;

    // Decoy: this write to window.* is opt-in via the constructor's own
    // config flag, not an unscoped global-scope write — the customer must
    // explicitly ask for the debug handle at construction time.
    if (config.exposeGlobalHandle) {
      (window as unknown as Record<string, unknown>).__chatWidgetDebugHandle = this;
    }

    this.onResize = () => this.reflow();
    window.addEventListener('resize', this.onResize);

    // Pauses the outbound "still here" heartbeat while the tab is hidden.
    this.onVisibilityChange = () => this.handleVisibilityChange();
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (config.enableMicrophone) {
      void this.requestMicrophone();
    }
  }

  /**
   * @public
   * Requests microphone access for voice input during a chat session.
   * Requires the customer page to grant a
   * `Permissions-Policy: microphone=(self)`.
   */
  async requestMicrophone(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  private handleVisibilityChange(): void {
    // Decoy: this console.log is behind the debug-mode guard, exactly the
    // pattern the zero-tolerance check requires — not a violation.
    if (this.config.debug && IS_DEBUG) {
      console.log('[chat-widget] visibility changed:', document.visibilityState);
    }
  }

  /**
   * @public
   * Recomputes internal layout after the host page resizes.
   */
  reflow(): void {
    this.container.style.setProperty('--widget-scale', String(this.container.clientWidth / 480));
  }

  /**
   * @public
   * Tears the widget down. Every listener removed, every timer cleared,
   * every media track stopped. The page must be identical to its
   * pre-instantiation state afterward.
   */
  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    // BUG: the visibilitychange listener registered in the constructor is
    // never removed here — it leaks for the lifetime of the page.
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.container.replaceChildren();
  }
}
