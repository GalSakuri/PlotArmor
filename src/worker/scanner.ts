/**
 * Scanner — Content Script scanning engine.
 *
 * Runs the Aho-Corasick matching inline on the main thread.
 * The trie construction and search are O(n) and complete in
 * microseconds for typical social media text, making a Web Worker
 * unnecessary for the content script context.
 *
 * (Content scripts cannot create Workers with chrome-extension:// URLs
 * because Workers run in the page's origin, not the extension's.)
 *
 * Exposes the same Promise-based API as the old WorkerBridge so
 * content-init.ts can use it as a drop-in replacement.
 */

import { AhoCorasick } from '../lib/aho-corasick';
import type { ScanMatch } from '../types/messages';

export class Scanner {
  private trie: AhoCorasick | null = null;

  /**
   * Build the trie from the given keywords.
   * Resolves immediately (synchronous under the hood).
   */
  async init(keywords: string[]): Promise<void> {
    this.trie = new AhoCorasick(keywords);
  }

  /**
   * Replace the keyword set.
   */
  updateKeywords(keywords: string[]): void {
    this.trie = new AhoCorasick(keywords);
  }

  /**
   * Scan a batch of text strings for keyword matches.
   */
  async scan(texts: string[]): Promise<ScanMatch[]> {
    if (!this.trie || texts.length === 0) return [];

    const results: ScanMatch[] = [];
    for (let i = 0; i < texts.length; i++) {
      for (const m of this.trie.search(texts[i])) {
        results.push({
          textIndex: i,
          keyword: m.keyword,
          start: m.start,
          end: m.end,
        });
      }
    }
    return results;
  }

  /**
   * No-op for API compatibility (no Worker to terminate).
   */
  destroy(): void {
    this.trie = null;
  }
}
