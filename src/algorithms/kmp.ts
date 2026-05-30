import type { MatchResult } from "./types";

export interface KmpKeywordResult {
  keyword: string;
  lpsTable: number[];
  preprocessingComparisons: number;
  searchComparisons: number;
  totalComparisons: number;
  matches: MatchResult[];
}

export interface KmpSearchResult {
  matches: MatchResult[];
  keywordResults: KmpKeywordResult[];
  comparisons: number;
}

export function buildKmpLpsTable(pattern: string): { lpsTable: number[]; comparisons: number } {
  const lpsTable: number[] = new Array(pattern.length).fill(0);
  let prefixLength = 0;
  let suffixIndex = 1;
  let comparisons = 0;

  while (suffixIndex < pattern.length) {
    comparisons += 1;

    if (pattern[suffixIndex] === pattern[prefixLength]) {
      prefixLength += 1;
      lpsTable[suffixIndex] = prefixLength;
      suffixIndex += 1;
    } else if (prefixLength > 0) {
      prefixLength = lpsTable[prefixLength - 1];
    } else {
      lpsTable[suffixIndex] = 0;
      suffixIndex += 1;
    }
  }

  return { lpsTable, comparisons };
}

export function searchKmp(text: string, keyword: string): KmpKeywordResult {
  const { lpsTable, comparisons: preprocessingComparisons } = buildKmpLpsTable(keyword);
  const matches: MatchResult[] = [];

  if (text.length === 0 || keyword.length === 0) {
    return {
      keyword,
      lpsTable,
      preprocessingComparisons,
      searchComparisons: 0,
      totalComparisons: preprocessingComparisons,
      matches
    };
  }

  let textIndex = 0;
  let patternIndex = 0;
  let searchComparisons = 0;

  let startTime = performance.now();

  while (textIndex < text.length) {
    searchComparisons += 1;

    if (text[textIndex] === keyword[patternIndex]) {
      textIndex += 1;
      patternIndex += 1;

      if (patternIndex === keyword.length) {
        const startIndex = textIndex - keyword.length;
        const endIndex = textIndex;

        const endTime = performance.now();
        const segmentDuration = endTime - startTime;

        matches.push({
          keyword,
          algorithm: "KMP",
          startIndex,
          endIndex,
          matchedText: text.slice(startIndex, endIndex),
          comparisons: preprocessingComparisons + searchComparisons,
          searchTime: segmentDuration
        });

        patternIndex = lpsTable[patternIndex - 1];
        startTime = performance.now();
      }
    } else if (patternIndex > 0) {
      patternIndex = lpsTable[patternIndex - 1];
    } else {
      textIndex += 1;
    }
  }

  return {
    keyword,
    lpsTable,
    preprocessingComparisons,
    searchComparisons,
    totalComparisons: preprocessingComparisons + searchComparisons,
    matches
  };
}

export function searchKmpKeywords(text: string, keywords: readonly string[]): KmpSearchResult {
  const keywordResults: KmpKeywordResult[] = [];
  const matches: MatchResult[] = [];
  let comparisons = 0;

  for (const keyword of keywords) {
    const result = searchKmp(text, keyword);
    
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
