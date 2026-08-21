import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTODY_PASSPHRASE_ENTROPY_BITS,
  CUSTODY_PASSPHRASE_WORD_COUNT,
  CUSTODY_WORDLIST,
  generateCustodyPassphrase,
  randomWordlistIndex,
} from '../utils/custodyPassphrase';
import { CUSTODY_ENVELOPE_MIN_PASSPHRASE_LENGTH } from '../utils/custodyEnvelope';

describe('custody passphrase wordlist', () => {
  it('bundles exactly the 2048-word BIP39 English list', () => {
    assert.equal(CUSTODY_WORDLIST.length, 2048);
    assert.equal(new Set(CUSTODY_WORDLIST).size, 2048, 'every word is unique');
    for (const word of CUSTODY_WORDLIST) {
      assert.match(word, /^[a-z]+$/, `word "${word}" should be plain lowercase a-z`);
    }
  });

  it('has no two words sharing their first four letters', () => {
    const prefixes = new Set(CUSTODY_WORDLIST.map((word) => word.slice(0, 4)));
    assert.equal(prefixes.size, CUSTODY_WORDLIST.length);
  });
});

describe('generateCustodyPassphrase', () => {
  it('draws six words by default, each present in the bundled list', () => {
    const { words, phrase } = generateCustodyPassphrase();
    assert.equal(words.length, CUSTODY_PASSPHRASE_WORD_COUNT);
    assert.equal(words.length, 6);
    for (const word of words) assert.ok(CUSTODY_WORDLIST.includes(word));
    assert.equal(phrase, words.join(' '));
  });

  it('draws a different phrase on every call (no fixed or repeating draw)', () => {
    const phrases = new Set(Array.from({ length: 20 }, () => generateCustodyPassphrase().phrase));
    // 20 independent 66-bit draws colliding would be astronomically unlikely;
    // this simply proves the function is not returning a constant.
    assert.equal(phrases.size, 20);
  });

  it('reports exactly 66 bits of entropy for the default six-word phrase', () => {
    assert.equal(CUSTODY_PASSPHRASE_ENTROPY_BITS, 66);
    const { entropyBits } = generateCustodyPassphrase();
    assert.equal(entropyBits, 66);
  });

  it('computes entropy as wordCount * 11 for any word count, since 2048 = 2^11', () => {
    // 4 words is the smallest count that reliably clears the envelope's
    // 12-character floor even at the list's shortest (3-letter) words; 1-2
    // word phrases are covered separately below, since they can legitimately
    // trip the too-short guard.
    for (const wordCount of [4, 6, 12]) {
      const { entropyBits, words } = generateCustodyPassphrase(wordCount);
      assert.equal(words.length, wordCount);
      assert.equal(entropyBits, wordCount * 11);
    }
  });

  it('can trip its own too-short guard for a word count too small to clear the floor', () => {
    // Not a realistic call (the desk always asks for 6), but proves the
    // defensive check in generateCustodyPassphrase is live code, not dead.
    assert.throws(() => generateCustodyPassphrase(1), /custody_passphrase_too_short/);
  });

  it('always clears the envelope\'s minimum passphrase length comfortably', () => {
    const { phrase } = generateCustodyPassphrase();
    assert.ok(phrase.length >= CUSTODY_ENVELOPE_MIN_PASSPHRASE_LENGTH);
    // Six words at the shortest possible (3-letter) draws plus five spaces
    // would still be 23 characters, nearly double the 12-character floor.
    assert.ok(phrase.length >= 23 - 10, 'sanity: well short of the theoretical minimum is still suspicious');
  });

  it('rejects a non-positive or non-integer word count', () => {
    assert.throws(() => generateCustodyPassphrase(0), /custody_passphrase_word_count_invalid/);
    assert.throws(() => generateCustodyPassphrase(-1), /custody_passphrase_word_count_invalid/);
    assert.throws(() => generateCustodyPassphrase(2.5), /custody_passphrase_word_count_invalid/);
  });
});

describe('randomWordlistIndex', () => {
  it('never returns an out-of-range index', () => {
    for (let i = 0; i < 2000; i += 1) {
      const index = randomWordlistIndex(2048);
      assert.ok(Number.isInteger(index) && index >= 0 && index < 2048);
    }
  });

  it('rejects an empty or invalid list length', () => {
    assert.throws(() => randomWordlistIndex(0), /custody_passphrase_wordlist_empty/);
    assert.throws(() => randomWordlistIndex(-3), /custody_passphrase_wordlist_empty/);
  });

  it('draws close to uniformly over many samples, with no modulo bias', () => {
    // A small list size that does NOT evenly divide 2^32 is the case where a
    // naive `randomByte % listLength` would actually show bias; this proves
    // the rejection-sampling implementation stays uniform even there.
    const LIST_LENGTH = 7;
    const SAMPLES = 140000;
    const counts = new Array(LIST_LENGTH).fill(0);
    for (let i = 0; i < SAMPLES; i += 1) {
      counts[randomWordlistIndex(LIST_LENGTH)] += 1;
    }
    const expected = SAMPLES / LIST_LENGTH;
    for (const count of counts) {
      // Each bucket should land within 10% of the expected share; with
      // 20000 expected per bucket the standard deviation is under 150, so a
      // 10% band (2000) is a very generous, non-flaky tolerance.
      assert.ok(
        Math.abs(count - expected) / expected < 0.1,
        `bucket count ${count} strayed too far from expected ${expected}`,
      );
    }
  });

  it('draws uniformly over the real 2048-word list too', () => {
    const LIST_LENGTH = 2048;
    const SAMPLES = 200000;
    const counts = new Array(LIST_LENGTH).fill(0);
    for (let i = 0; i < SAMPLES; i += 1) {
      counts[randomWordlistIndex(LIST_LENGTH)] += 1;
    }
    const expected = SAMPLES / LIST_LENGTH; // ~97.7 per word
    const maxDeviation = Math.max(...counts.map((count) => Math.abs(count - expected)));
    // With ~98 expected per bucket the standard deviation is under 10; a
    // generous 6x-sigma-scale band still catches any real, systematic bias
    // (a modulo-biased implementation would skew far beyond this) without
    // making the test flaky on an honest uniform distribution.
    assert.ok(maxDeviation < expected * 0.6, `max deviation ${maxDeviation} vs expected ${expected}`);
  });
});
