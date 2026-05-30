import type { MatchResult } from "./types";

const HASH_BASE = 256;
const HASH_MODULUS = 1_000_000_007;

export interface RabinKarpKeywordResult {
  keyword: string;
  patternHash: number;
  searchComparisons: number;
  hashComparisons: number;
  totalComparisons: number;
  matches: MatchResult[];
}

export interface RabinKarpSearchResult {
  matches: MatchResult[];
  keywordResults: RabinKarpKeywordResult[];
  comparisons: number;
}

function calculateInitialHash(text: string, length: number): number {
  let hash = 0;

  for (let index = 0; index < length; index += 1) {
    hash = (hash * HASH_BASE + text.charCodeAt(index)) % HASH_MODULUS;
  }

  return hash;
}

function calculateHighestBasePower(length: number): number {
  let power = 1;

  for (let index = 1; index < length; index += 1) {
    power = (power * HASH_BASE) % HASH_MODULUS;
  }

  return power;
}

function rollHash(previousHash: number, outgoingCode: number, incomingCode: number, highestBasePower: number): number {
  const withoutOutgoing = (previousHash - (outgoingCode * highestBasePower) % HASH_MODULUS + HASH_MODULUS) % HASH_MODULUS;

  return (withoutOutgoing * HASH_BASE + incomingCode) % HASH_MODULUS;
}

function verifyMatchAt(text: string, keyword: string, startIndex: number): { isMatch: boolean; comparisons: number } {
  let comparisons = 0;

  for (let index = 0; index < keyword.length; index += 1) {
    comparisons += 1;

    if (text[startIndex + index] !== keyword[index]) {
      return {
        isMatch: false,
        comparisons
      };
    }
  }

  return {
    isMatch: true,
    comparisons
  };
}

export function searchRabinKarp(text: string, keyword: string): RabinKarpKeywordResult {
  const matches: MatchResult[] = [];

  if (text.length === 0 || keyword.length === 0 || keyword.length > text.length) {
    return {
      keyword,
      patternHash: 0,
      searchComparisons: 0,
      hashComparisons: 0,
      totalComparisons: 0,
      matches
    };
  }

  const patternHash = calculateInitialHash(keyword, keyword.length);
  let windowHash = calculateInitialHash(text, keyword.length);
  const highestBasePower = calculateHighestBasePower(keyword.length);
  let searchComparisons = 0;
  let hashComparisons = 0;

  let startTime = performance.now();

  for (let startIndex = 0; startIndex <= text.length - keyword.length; startIndex += 1) {
    hashComparisons += 1;

    if (windowHash === patternHash) {
      const verification = verifyMatchAt(text, keyword, startIndex);
      searchComparisons += verification.comparisons;

      if (verification.isMatch) {
        const endIndex = startIndex + keyword.length;

        const endTime = performance.now();
        const segmentDuration = endTime - startTime;

        matches.push({
          keyword,
          algorithm: "Rabin-Karp",
          startIndex,
          endIndex,
          matchedText: text.slice(startIndex, endIndex),
          comparisons: hashComparisons + searchComparisons,
          searchTime: segmentDuration
        });

        startTime = performance.now();
      }
    }

    if (startIndex < text.length - keyword.length) {
      windowHash = rollHash(
        windowHash,
        text.charCodeAt(startIndex),
        text.charCodeAt(startIndex + keyword.length),
        highestBasePower
      );
    }
  }

  return {
    keyword,
    patternHash,
    searchComparisons,
    hashComparisons,
    totalComparisons: hashComparisons + searchComparisons,
    matches
  };
}

export function searchRabinKarpKeywords(text: string, keywords: readonly string[]): RabinKarpSearchResult {
  const keywordResults: RabinKarpKeywordResult[] = [];
  const matches: MatchResult[] = [];
  let comparisons = 0;

  for (const keyword of keywords) {
    const result = searchRabinKarp(text, keyword);

    keywordResults.push(result);
    comparisons += result.totalComparisons;

    for (const match of result.matches) {
      matches.push(match);
    }
  }

  return {
    matches,
    keywordResults,
    comparisons
  };
}
