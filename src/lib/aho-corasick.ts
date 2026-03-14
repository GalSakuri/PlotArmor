/**
 * Aho-Corasick Multi-Pattern String Matching
 *
 * Builds a finite automaton from a set of keywords allowing simultaneous
 * search for all patterns in O(n + m + z) time, where:
 *   n = length of the input text
 *   m = total length of all keywords
 *   z = number of matches found
 *
 * This is the core of PlotArmor's spoiler detection engine, running
 * entirely inside a Web Worker to keep the main thread free.
 */

interface TrieNode {
  /** Map from character → child node index */
  children: Map<string, number>;
  /** Failure link: longest proper suffix that is also a prefix in the trie */
  fail: number;
  /** Dictionary link: nearest ancestor via fail links that has output (optimization) */
  dict: number;
  /** Keywords that terminate at this node */
  output: string[];
}

export interface AhoCorasickMatch {
  keyword: string;
  /** Inclusive start offset in the text */
  start: number;
  /** Exclusive end offset in the text */
  end: number;
}

export class AhoCorasick {
  private nodes: TrieNode[];
  private readonly keywordCount: number;

  constructor(keywords: string[]) {
    // Pre-allocate root node
    this.nodes = [this.makeNode()];

    const normalized = keywords
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    this.keywordCount = normalized.length;

    for (const kw of normalized) {
      this.insertKeyword(kw);
    }

    this.buildFailureLinks();
  }

  get size(): number {
    return this.nodes.length;
  }

  get patterns(): number {
    return this.keywordCount;
  }

  // ─── Phase 1: Trie Construction ──────────────────────────────────────────────

  private makeNode(): TrieNode {
    return { children: new Map(), fail: 0, dict: 0, output: [] };
  }

  private insertKeyword(word: string): void {
    let cur = 0;
    for (const ch of word) {
      let next = this.nodes[cur].children.get(ch);
      if (next === undefined) {
        next = this.nodes.length;
        this.nodes[cur].children.set(ch, next);
        this.nodes.push(this.makeNode());
      }
      cur = next;
    }
    this.nodes[cur].output.push(word);
  }

  // ─── Phase 2: Failure Link Construction (BFS) ────────────────────────────────

  private buildFailureLinks(): void {
    const queue: number[] = [];

    // Depth-1 nodes: their failure link always points back to root (0)
    for (const [, child] of this.nodes[0].children) {
      this.nodes[child].fail = 0;
      this.nodes[child].dict = 0;
      queue.push(child);
    }

    while (queue.length > 0) {
      const cur = queue.shift()!;

      for (const [ch, child] of this.nodes[cur].children) {
        // Walk failure links from parent until we find a node with a transition
        // on 'ch', or fall back to root
        let failState = this.nodes[cur].fail;
        while (failState !== 0 && !this.nodes[failState].children.has(ch)) {
          failState = this.nodes[failState].fail;
        }

        const failTarget = this.nodes[failState].children.get(ch);
        // Guard against self-loops at root
        this.nodes[child].fail =
          failTarget !== undefined && failTarget !== child ? failTarget : 0;

        // Merge outputs from the failure node (handles overlapping patterns)
        const failNode = this.nodes[this.nodes[child].fail];
        this.nodes[child].output.push(...failNode.output);

        // Dictionary link: skip to nearest ancestor with outputs (fast suffix scanning)
        if (failNode.output.length > 0) {
          this.nodes[child].dict = this.nodes[child].fail;
        } else {
          this.nodes[child].dict = failNode.dict;
        }

        queue.push(child);
      }
    }
  }

  // ─── Phase 3: Search ─────────────────────────────────────────────────────────

  /**
   * Search for all keyword occurrences in `text`.
   * Returns matches sorted by their start position.
   * Case-insensitive: text is normalized to lowercase before matching.
   */
  search(text: string): AhoCorasickMatch[] {
    if (this.keywordCount === 0 || text.length === 0) return [];

    const lower = text.toLowerCase();
    const results: AhoCorasickMatch[] = [];
    let cur = 0;

    for (let i = 0; i < lower.length; i++) {
      const ch = lower[i];

      // Follow failure links until we find a valid transition or reach root
      while (cur !== 0 && !this.nodes[cur].children.has(ch)) {
        cur = this.nodes[cur].fail;
      }

      cur = this.nodes[cur].children.get(ch) ?? 0;

      // Collect all outputs at this node.
      // Since buildFailureLinks() already merges outputs from the entire
      // failure chain into each node, this array contains ALL keywords
      // that end at position i — no dictionary link walk needed.
      for (const kw of this.nodes[cur].output) {
        results.push({ keyword: kw, start: i - kw.length + 1, end: i + 1 });
      }
    }

    // Sort by start position for predictable output
    results.sort((a, b) => a.start - b.start);
    return results;
  }

  /**
   * Returns true if the text contains at least one keyword match.
   * Faster than search() when you only need a boolean result —
   * stops at the first match found.
   */
  hasMatch(text: string): boolean {
    if (this.keywordCount === 0 || text.length === 0) return false;

    const lower = text.toLowerCase();
    let cur = 0;

    for (let i = 0; i < lower.length; i++) {
      const ch = lower[i];

      while (cur !== 0 && !this.nodes[cur].children.has(ch)) {
        cur = this.nodes[cur].fail;
      }

      cur = this.nodes[cur].children.get(ch) ?? 0;

      // Since outputs are merged via failure links, checking output.length
      // is sufficient — no dictionary link walk needed.
      if (this.nodes[cur].output.length > 0) return true;
    }

    return false;
  }

  /**
   * Returns distinct keyword strings that appear in the text,
   * without position information. Useful for badge counts.
   */
  matchedKeywords(text: string): Set<string> {
    const found = new Set<string>();
    for (const m of this.search(text)) {
      found.add(m.keyword);
    }
    return found;
  }
}
