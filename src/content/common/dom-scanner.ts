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
      characterData: true,
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
    const textChangedElements = new Set<Element>();

    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        // Existing Text node's data changed — find nearest matching ancestor
        const parent = mutation.target.parentElement;
        if (parent) {
          const match = this.findMatchingAncestor(parent);
          if (match) textChangedElements.add(match);
        }
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          // Check if node itself matches
          if (this.matchesSelectors(el)) newNodes.push(el);
          // Check descendants
          newNodes.push(...this.queryAll(el));
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          // A Text node was added inside an existing element (e.g., SPA
          // frameworks that populate text after the shell element is already
          // in the DOM). Find the nearest matching ancestor and re-scan it.
          const parent = node.parentElement;
          if (parent) {
            const match = this.findMatchingAncestor(parent);
            if (match) textChangedElements.add(match);
          }
        }
      }
    }

    // Re-scan elements whose text content changed (remove scanned marker first)
    for (const el of textChangedElements) {
      el.removeAttribute(SCANNED_ATTR);
      newNodes.push(el);
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

    // Separate elements with text from empty ones.
    // Some SPA frameworks add DOM shells first and populate text content
    // asynchronously — scanning empty elements wastes a cycle and marks
    // them as done before they have content.
    const ready: Element[] = [];
    const empty: Element[] = [];
    for (const el of batch) {
      if ((el.textContent ?? '').trim().length > 0) {
        ready.push(el);
      } else {
        empty.push(el);
      }
    }

    // Empty elements stay unscanned. Schedule a retry — IntersectionObserver
    // won't re-fire for elements already in the viewport, and the Text node
    // mutation might have already been missed.
    if (empty.length > 0) {
      setTimeout(() => {
        for (const el of empty) {
          if (el.isConnected && !el.hasAttribute(SCANNED_ATTR) && (el.textContent ?? '').trim().length > 0) {
            this.pendingNodes.add(el);
          }
        }
        if (this.pendingNodes.size > 0) this.flush();
      }, 500);
    }

    if (ready.length === 0) return;

    // Mark as scanned before the async call to prevent double-processing
    ready.forEach(el => {
      el.setAttribute(SCANNED_ATTR, 'true');
      this.intersectionObserver.unobserve(el);
    });

    logger.log(`Flushing ${ready.length} elements to scanner (${empty.length} deferred — empty text)`);

    try {
      await this.options.onNodes(ready);
    } catch (err) {
      logger.error('onNodes callback threw:', err);
      // Reset markers so they can be retried
      ready.forEach(el => el.removeAttribute(SCANNED_ATTR));
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

  /** Walk up from `el` to find the nearest element matching our selectors. */
  private findMatchingAncestor(el: Element): Element | null {
    let cur: Element | null = el;
    while (cur) {
      if (this.matchesSelectors(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
}
