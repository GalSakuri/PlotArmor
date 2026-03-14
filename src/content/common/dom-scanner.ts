/**
 * DomScanner — Efficiently monitors and extracts text nodes from the page.
 *
 * Strategy:
 * 1. IntersectionObserver: Only scans elements that enter the viewport,
 *    avoiding wasted work on off-screen content.
 * 2. MutationObserver: Watches for new DOM nodes (infinite scroll, SPA nav).
 * 3. 250ms debounce on mutation events to batch rapid DOM changes.
 * 4. Skips already-scanned elements via a WeakSet.
 */

import { logger } from '../../shared/logger';

export interface DomScannerOptions {
  /** CSS selectors for text containers to observe */
  selectors: string[];
  /** Called with a batch of visible, unscanned elements */
  onNodes: (nodes: Element[]) => Promise<void>;
}

const SCANNED_ATTR = 'data-pa-scanned';
const DEBOUNCE_MS = 250;

export class DomScanner {
  private options: DomScannerOptions;
  private intersectionObserver: IntersectionObserver;
  private mutationObserver: MutationObserver;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingNodes = new Set<Element>();
  private connected = false;

  constructor(options: DomScannerOptions) {
    this.options = options;

    this.intersectionObserver = new IntersectionObserver(
      this.onIntersection.bind(this),
      { rootMargin: '200px' } // pre-scan 200px before entering viewport
    );

    this.mutationObserver = new MutationObserver(
      this.onMutation.bind(this)
    );
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Start observing the given root element.
   * Immediately scans all matching elements already in DOM.
   */
  observe(root: Element): void {
    if (this.connected) return;
    this.connected = true;

    this.mutationObserver.observe(root, {
      childList: true,
      subtree: true,
    });

    // Initial scan of all existing matching elements
    this.scheduleElementScan(this.queryAll(root));
    logger.log(`DomScanner observing with ${this.options.selectors.length} selectors`);
  }

  /**
   * Re-scan all currently visible elements (e.g., after keyword update).
   */
  rescan(): void {
    const root = document.body;
    const all = this.queryAll(root);
    // Reset scan markers so they get re-evaluated
    all.forEach(el => el.removeAttribute(SCANNED_ATTR));
    this.scheduleElementScan(all);
  }

  /**
   * Stop all observers and clean up.
   */
  disconnect(): void {
    this.connected = false;
    this.intersectionObserver.disconnect();
    this.mutationObserver.disconnect();
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.pendingNodes.clear();
  }

  // ─── Observers ─────────────────────────────────────────────────────────────

  private onIntersection(entries: IntersectionObserverEntry[]): void {
    const visible = entries
      .filter(e => e.isIntersecting)
      .map(e => e.target)
      .filter(el => !el.hasAttribute(SCANNED_ATTR));

    if (visible.length > 0) {
      this.scheduleFlush(visible);
    }
  }

  private onMutation(mutations: MutationRecord[]): void {
    const newNodes: Element[] = [];

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        // Check if node itself matches
        if (this.matchesSelectors(el)) newNodes.push(el);
        // Check descendants
        newNodes.push(...this.queryAll(el));
      }
    }

    if (newNodes.length > 0) {
      this.scheduleElementScan(newNodes);
    }
  }

  // ─── Scheduling ────────────────────────────────────────────────────────────

  /** Register elements with IntersectionObserver for viewport-aware scanning */
  private scheduleElementScan(elements: Element[]): void {
    for (const el of elements) {
      if (!el.hasAttribute(SCANNED_ATTR)) {
        this.intersectionObserver.observe(el);
      }
    }
  }

  /** Debounce-flush visible elements to onNodes callback */
  private scheduleFlush(nodes: Element[]): void {
    for (const n of nodes) this.pendingNodes.add(n);

    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flush();
    }, DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    if (this.pendingNodes.size === 0) return;

    const batch = [...this.pendingNodes].filter(
      el => el.isConnected && !el.hasAttribute(SCANNED_ATTR)
    );
    this.pendingNodes.clear();

    if (batch.length === 0) return;

    // Mark as scanned before the async call to prevent double-processing
    batch.forEach(el => {
      el.setAttribute(SCANNED_ATTR, 'true');
      this.intersectionObserver.unobserve(el);
    });

    logger.log(`Flushing ${batch.length} elements to scanner`);

    try {
      await this.options.onNodes(batch);
    } catch (err) {
      logger.error('onNodes callback threw:', err);
      // Reset markers so they can be retried
      batch.forEach(el => el.removeAttribute(SCANNED_ATTR));
    }
  }

  // ─── DOM Helpers ───────────────────────────────────────────────────────────

  private queryAll(root: Element): Element[] {
    const selector = this.options.selectors.join(', ');
    if (!selector) return [];
    return Array.from(root.querySelectorAll(selector));
  }

  private matchesSelectors(el: Element): boolean {
    return this.options.selectors.some(sel => {
      try { return el.matches(sel); } catch { return false; }
    });
  }
}
