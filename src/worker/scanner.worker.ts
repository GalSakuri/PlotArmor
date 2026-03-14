/**
 * PlotArmor Scanner Web Worker
 *
 * Runs entirely off the main thread. Owns the single AhoCorasick instance
 * and processes all text scan requests. The main thread communicates via
 * typed postMessage — no shared memory, no locks needed.
 */

import { AhoCorasick } from '../lib/aho-corasick';
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  ScanMatch,
} from '../types/messages';

// The automaton instance — rebuilt whenever keywords change
let trie: AhoCorasick | null = null;

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'INIT_TRIE': {
        trie = new AhoCorasick(msg.keywords);
        reply({ type: 'TRIE_READY' });
        break;
      }

      case 'UPDATE_KEYWORDS': {
        // Rebuild trie in-place; subsequent SCAN_BATCH calls use the new one
        trie = new AhoCorasick(msg.keywords);
        // No response needed — caller uses fire-and-forget
        break;
      }

      case 'SCAN_BATCH': {
        if (!trie) {
          reply({ type: 'ERROR', message: 'SCAN_BATCH received before INIT_TRIE' });
          return;
        }

        const matches: ScanMatch[] = msg.texts.flatMap((text, textIndex) =>
          trie!.search(text).map(m => ({
            textIndex,
            keyword: m.keyword,
            start: m.start,
            end: m.end,
          }))
        );

        reply({ type: 'SCAN_RESULT', batchId: msg.batchId, matches });
        break;
      }

      default: {
        // Exhaustive check — TypeScript will error if a case is unhandled
        const _exhaustive: never = msg;
        reply({ type: 'ERROR', message: `Unknown message type: ${JSON.stringify(_exhaustive)}` });
      }
    }
  } catch (err) {
    reply({
      type: 'ERROR',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

function reply(msg: WorkerOutboundMessage): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
}
