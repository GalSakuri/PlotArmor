import { describe, it, expect } from 'vitest';
import { AhoCorasick } from './aho-corasick';

describe('AhoCorasick', () => {
  // ── Construction ────────────────────────────────────────────────────────────

  it('builds with empty keyword list without throwing', () => {
    expect(() => new AhoCorasick([])).not.toThrow();
  });

  it('returns no matches on empty trie', () => {
    const ac = new AhoCorasick([]);
    expect(ac.search('One Piece chapter 1100')).toEqual([]);
    expect(ac.hasMatch('anything')).toBe(false);
  });

  it('returns no matches on empty text', () => {
    const ac = new AhoCorasick(['luffy', 'zoro']);
    expect(ac.search('')).toEqual([]);
  });

  // ── Basic Single-Pattern Matching ───────────────────────────────────────────

  it('finds a single exact keyword', () => {
    const ac = new AhoCorasick(['luffy']);
    const matches = ac.search('Luffy defeats Kaido');
    expect(matches).toHaveLength(1);
    expect(matches[0].keyword).toBe('luffy');
    expect(matches[0].start).toBe(0);
    expect(matches[0].end).toBe(5);
  });

  it('is case-insensitive', () => {
    const ac = new AhoCorasick(['STARK']);
    const matches = ac.search('Ned Stark is dead');
    expect(matches).toHaveLength(1);
    expect(matches[0].keyword).toBe('stark');
  });

  it('finds keyword at end of string', () => {
    const ac = new AhoCorasick(['death']);
    const matches = ac.search('Jon Snow is back from death');
    expect(matches[0].start).toBe(22); // 'Jon Snow is back from death' — 'd' is at index 22
  });

  it('finds all occurrences of the same keyword', () => {
    const ac = new AhoCorasick(['dead']);
    const matches = ac.search('He is dead. She is dead too.');
    expect(matches).toHaveLength(2);
  });

  // ── Multi-Pattern Matching ───────────────────────────────────────────────────

  it('finds multiple distinct keywords in one pass', () => {
    const ac = new AhoCorasick(['ned', 'stark', 'red wedding']);
    const text = 'Ned Stark dies at the Red Wedding';
    const matches = ac.search(text);
    const keywords = matches.map(m => m.keyword);
    expect(keywords).toContain('ned');
    expect(keywords).toContain('stark');
    expect(keywords).toContain('red wedding');
  });

  it('handles overlapping patterns correctly', () => {
    // "he" is a suffix of "she"
    const ac = new AhoCorasick(['he', 'she', 'his', 'hers']);
    const matches = ac.search('ushers');
    const keywords = matches.map(m => m.keyword);
    expect(keywords).toContain('he');
    expect(keywords).toContain('she');
    expect(keywords).toContain('hers');
  });

  it('does not produce duplicate matches for overlapping patterns', () => {
    const ac = new AhoCorasick(['he', 'she', 'his', 'hers']);
    const matches = ac.search('ushers');
    // "he" should appear exactly once (at position 2), not duplicated
    const heMatches = matches.filter(m => m.keyword === 'he');
    expect(heMatches).toHaveLength(1);
    // Total: "she" at 1, "he" at 2, "hers" at 2
    expect(matches).toHaveLength(3);
  });

  it('finds patterns that are substrings of other patterns', () => {
    const ac = new AhoCorasick(['die', 'dies', 'died']);
    const matches = ac.search('He dies');
    const keywords = new Set(matches.map(m => m.keyword));
    expect(keywords.has('die')).toBe(true);
    expect(keywords.has('dies')).toBe(true);
  });

  // ── hasMatch (Early Exit) ────────────────────────────────────────────────────

  it('hasMatch returns true when keyword is present', () => {
    const ac = new AhoCorasick(['spoiler']);
    expect(ac.hasMatch('This contains a spoiler warning')).toBe(true);
  });

  it('hasMatch returns false when no keyword is present', () => {
    const ac = new AhoCorasick(['kaido']);
    expect(ac.hasMatch('One Piece is a great manga')).toBe(false);
  });

  // ── matchedKeywords ──────────────────────────────────────────────────────────

  it('matchedKeywords returns distinct set without duplicates', () => {
    const ac = new AhoCorasick(['luffy', 'zoro']);
    const text = 'Luffy and luffy fight alongside Zoro and zoro';
    const found = ac.matchedKeywords(text);
    expect(found.size).toBe(2);
    expect(found.has('luffy')).toBe(true);
    expect(found.has('zoro')).toBe(true);
  });

  // ── Real-World Spoiler Scenarios ─────────────────────────────────────────────

  it('catches One Piece chapter spoiler pattern', () => {
    const ac = new AhoCorasick(['luffy gear 5', 'nika', 'joy boy']);
    const tweet = "Chapter 1044 is insane — Luffy Gear 5 is literally Nika, the Joy Boy prophecy!";
    const matches = ac.search(tweet);
    const keywords = new Set(matches.map(m => m.keyword));
    expect(keywords.has('luffy gear 5')).toBe(true);
    expect(keywords.has('nika')).toBe(true);
    expect(keywords.has('joy boy')).toBe(true);
  });

  it('catches Game of Thrones death spoiler', () => {
    const ac = new AhoCorasick(['red wedding', 'ned stark dies', 'oberyn']);
    const text = 'The Red Wedding is the most shocking moment after Ned Stark dies in season 1';
    const found = ac.matchedKeywords(text);
    expect(found.has('red wedding')).toBe(true);
    expect(found.has('ned stark dies')).toBe(true);
  });

  it('handles multi-word phrases correctly', () => {
    const ac = new AhoCorasick(['who dies in breaking bad']);
    const text = 'Who dies in Breaking Bad? — spoiler question';
    expect(ac.hasMatch(text)).toBe(true);
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────────

  it('trims and deduplicates whitespace-only keywords silently', () => {
    expect(() => new AhoCorasick(['', '   ', 'valid'])).not.toThrow();
    const ac = new AhoCorasick(['', '   ', 'valid']);
    expect(ac.patterns).toBe(1);
  });

  it('handles Unicode characters', () => {
    const ac = new AhoCorasick(['naruto', '火影']);
    expect(ac.hasMatch('Naruto becomes 火影')).toBe(true);
  });

  it('sorts results by start position', () => {
    const ac = new AhoCorasick(['zoro', 'luffy', 'sanji']);
    const matches = ac.search('Luffy, Zoro and Sanji');
    expect(matches[0].keyword).toBe('luffy');
    expect(matches[1].keyword).toBe('zoro');
    expect(matches[2].keyword).toBe('sanji');
  });
});
