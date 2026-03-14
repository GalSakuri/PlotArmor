/**
 * DomCloaker — applies and removes the spoiler blur overlay on DOM nodes.
 *
 * Design:
 * - Applies a CSS blur filter + semi-opaque overlay with "Click to reveal" text
 * - Click-to-reveal is single element: one click reveals, another click re-blurs
 * - All DOM mutations are batched inside requestAnimationFrame to prevent layout thrashing
 * - Injects styles only once per page load
 */

const STYLE_ID = 'plot-armor-styles';
const CLOAKED_ATTR = 'data-pa-cloaked';
const WRAPPER_CLASS = 'pa-spoiler-wrapper';
const OVERLAY_CLASS = 'pa-spoiler-overlay';
const REVEALED_CLASS = 'pa-revealed';

const CSS = `
.${WRAPPER_CLASS} {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
}
.${WRAPPER_CLASS} > *:not(.${OVERLAY_CLASS}) {
  filter: blur(20px) brightness(0.5);
  user-select: none;
  pointer-events: none;
  transition: filter 0.3s ease;
}
.${WRAPPER_CLASS}.${REVEALED_CLASS} > *:not(.${OVERLAY_CLASS}) {
  filter: none;
  user-select: auto;
  pointer-events: auto;
}
.${OVERLAY_CLASS} {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 4px;
  cursor: pointer;
  z-index: 9999;
  transition: opacity 0.2s ease;
}
.${WRAPPER_CLASS}.${REVEALED_CLASS} .${OVERLAY_CLASS} {
  opacity: 0;
  pointer-events: none;
}
.${OVERLAY_CLASS} .pa-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}
.${OVERLAY_CLASS} .pa-overlay-title {
  color: #fff;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  padding: 6px 14px;
  background: rgba(0,0,0,0.6);
  border-radius: 20px;
}
.${OVERLAY_CLASS} .pa-overlay-keyword {
  color: rgba(255,255,255,0.7);
  font-family: system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}
`;

export class DomCloaker {
  /** All wrapped elements — used for mass uncloak */
  private cloaked = new Set<Element>();
  /** rAF pending flag */
  private rafPending = false;
  /** Queue of pending cloak/uncloak operations */
  private pendingOps: Array<() => void> = [];

  constructor() {
    this.injectStyles();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Blur a DOM element with the spoiler overlay.
   * @param el       The element to cloak
   * @param keyword  The matching keyword shown in the overlay
   */
  cloak(el: Element, keyword: string): void {
    if (el.hasAttribute(CLOAKED_ATTR)) return; // already cloaked

    this.enqueue(() => {
      // Avoid double-wrapping
      if (el.hasAttribute(CLOAKED_ATTR)) return;
      el.setAttribute(CLOAKED_ATTR, 'true');

      const wrapper = document.createElement('div');
      wrapper.className = WRAPPER_CLASS;
      wrapper.setAttribute('data-pa-wrapper', 'true');

      const escaped = keyword.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const overlay = document.createElement('div');
      overlay.className = OVERLAY_CLASS;
      overlay.innerHTML = `<div class="pa-overlay-content">
        <span class="pa-overlay-title">Spoiler — Click to reveal</span>
        <span class="pa-overlay-keyword">Triggered by: "${escaped}"</span>
      </div>`;

      overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper.classList.toggle(REVEALED_CLASS);
      });

      el.parentNode?.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      wrapper.appendChild(overlay);

      this.cloaked.add(wrapper);
    });
  }

  /**
   * Remove all spoiler overlays on the page (e.g., when extension is disabled).
   */
  uncloak(): void {
    this.enqueue(() => {
      for (const wrapper of this.cloaked) {
        const child = wrapper.querySelector(`[${CLOAKED_ATTR}]`);
        if (child) {
          child.removeAttribute(CLOAKED_ATTR);
          wrapper.parentNode?.insertBefore(child, wrapper);
        }
        wrapper.remove();
      }
      this.cloaked.clear();
    });
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private enqueue(op: () => void): void {
    this.pendingOps.push(op);
    if (!this.rafPending) {
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        const ops = this.pendingOps.splice(0);
        for (const fn of ops) fn();
      });
    }
  }

  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head?.appendChild(style);
  }
}
