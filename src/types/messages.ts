// ─── Worker Inbound (Main Thread → Worker) ───────────────────────────────────

export type WorkerInboundMessage =
  | { type: 'INIT_TRIE'; keywords: string[] }
  | { type: 'SCAN_BATCH'; batchId: string; texts: string[] }
  | { type: 'UPDATE_KEYWORDS'; keywords: string[] };

// ─── Worker Outbound (Worker → Main Thread) ──────────────────────────────────

export type WorkerOutboundMessage =
  | { type: 'TRIE_READY' }
  | { type: 'SCAN_RESULT'; batchId: string; matches: ScanMatch[] }
  | { type: 'ERROR'; message: string };

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface ScanMatch {
  /** Index into the texts[] array that was submitted in SCAN_BATCH */
  textIndex: number;
  /** The keyword that matched */
  keyword: string;
  /** Inclusive start character offset in the original text */
  start: number;
  /** Exclusive end character offset in the original text */
  end: number;
}
