/**
 * WorkerBridge — Main Thread Proxy for the Scanner Worker
 *
 * Provides a clean, Promise-based API over raw postMessage/onmessage.
 * All content scripts interact with this class rather than the Worker directly.
 *
 * Usage:
 *   const bridge = new WorkerBridge();
 *   await bridge.init(['luffy', 'red wedding', 'stark']);
 *   const matches = await bridge.scan(['Ned Stark dies!', 'I love ramen']);
 */

import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  ScanMatch,
} from '../types/messages';

export class WorkerBridge {
  private worker: Worker;

  /** Pending scan promises keyed by batchId (UUID) */
  private pendingScans = new Map<string, (matches: ScanMatch[]) => void>();

  /** Resolves when the worker has acknowledged INIT_TRIE */
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (reason: Error) => void;

  /** Whether the bridge has been terminated */
  private terminated = false;

  constructor() {
    // Use chrome.runtime.getURL for a stable, extension-accessible path.
    // The worker bundle lands at dist/worker/scanner.worker.js (no content hash)
    // because we declare it as a named rollupOptions input in vite.config.ts.
    const workerUrl = chrome.runtime.getURL('worker/scanner.worker.js');
    this.worker = new Worker(workerUrl, { type: 'module' });

    this.readyPromise = new Promise<void>((res, rej) => {
      this.resolveReady = res;
      this.rejectReady = rej;
    });

    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = (err) => {
      console.error('[PlotArmor] Worker error:', err.message);
      this.rejectReady(new Error(err.message));
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Send initial keyword list to the worker.
   * Must be called (and awaited) before scan().
   */
  async init(keywords: string[]): Promise<void> {
    this.post({ type: 'INIT_TRIE', keywords });
    return this.readyPromise;
  }

  /**
   * Replace the keyword set without restarting the worker.
   * Fire-and-forget — subsequent scan() calls will use the new trie.
   */
  updateKeywords(keywords: string[]): void {
    this.post({ type: 'UPDATE_KEYWORDS', keywords });
  }

  /**
   * Scan a batch of text strings for keyword matches.
   * Returns all matches across all texts, each tagged with textIndex.
   */
  async scan(texts: string[]): Promise<ScanMatch[]> {
    if (this.terminated) return [];
    if (texts.length === 0) return [];

    return new Promise<ScanMatch[]>((resolve) => {
      const batchId = crypto.randomUUID();
      this.pendingScans.set(batchId, resolve);
      this.post({ type: 'SCAN_BATCH', batchId, texts });

      // Safety timeout: resolve with empty if worker is unresponsive after 5s
      setTimeout(() => {
        if (this.pendingScans.has(batchId)) {
          console.warn('[PlotArmor] Scan batch timed out:', batchId);
          this.pendingScans.delete(batchId);
          resolve([]);
        }
      }, 5000);
    });
  }

  /**
   * Terminate the worker and clean up all pending scans.
   * The bridge is unusable after this call.
   */
  destroy(): void {
    this.terminated = true;
    // Resolve all pending scans with empty results
    for (const resolve of this.pendingScans.values()) {
      resolve([]);
    }
    this.pendingScans.clear();
    this.worker.terminate();
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private handleMessage(event: MessageEvent<WorkerOutboundMessage>): void {
    const msg = event.data;

    switch (msg.type) {
      case 'TRIE_READY':
        this.resolveReady();
        break;

      case 'SCAN_RESULT': {
        const resolve = this.pendingScans.get(msg.batchId);
        if (resolve) {
          this.pendingScans.delete(msg.batchId);
          resolve(msg.matches);
        }
        break;
      }

      case 'ERROR':
        console.error('[PlotArmor Worker]', msg.message);
        break;

      default: {
        const _exhaustive: never = msg;
        console.warn('[PlotArmor] Unknown worker message:', _exhaustive);
      }
    }
  }

  private post(msg: WorkerInboundMessage): void {
    if (!this.terminated) {
      this.worker.postMessage(msg);
    }
  }
}
