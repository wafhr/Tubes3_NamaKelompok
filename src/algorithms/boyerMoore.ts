import type { MatchResult } from "./types";

export interface BoyerMooreKeywordResult {
  keyword: string;
  lastOccurrence: Map<string, number>;
  searchComparisons: number;
  matches: MatchResult[];
}

export interface BoyerMooreSearchResult {
  matches: MatchResult[];
  keywordResults: BoyerMooreKeywordResult[];
  comparisons: number;
}

function buildLastOccurrence(pattern: string): Map<string, number>{
    const lastOccurrence = new Map<string, number>();
    for(let i = 0; i < pattern.length; i++){
        lastOccurrence.set(pattern[i], i);
    }
    return lastOccurrence;
}

export function searchBoyerMoore(text: string, keyword: string): BoyerMooreKeywordResult {
    const lastOccurrence = buildLastOccurrence(keyword);
    const matches: MatchResult[] = [];

    const n = keyword.length;
    const m = text.length;

    if (n === 0 || m < n) {
        return {
            keyword,
            lastOccurrence,
            searchComparisons: 0,
            matches,
        };
    }

    let searchComparisons = 0;
    let textIndex = 0;

    let startTime = performance.now();

    while (textIndex <= m - n) {
        let patternIndex = n - 1;

        while (patternIndex >= 0) {
            searchComparisons++;

            if(keyword[patternIndex] === text[textIndex + patternIndex]) {
                patternIndex--;
            }else{
                break;
            }
        }

        // seluruh pattern cocok
        if (patternIndex < 0) {
            const startIndex = textIndex;
            const endIndex = textIndex + n;
            
            const endTime = performance.now();
            const segmentDuration = endTime - startTime;

            matches.push({
                keyword,
                algorithm: "Boyer-Moore",
                startIndex,
                endIndex,
                matchedText: text.slice(startIndex, endIndex),
                comparisons: searchComparisons,
                searchTime: segmentDuration
            });

            textIndex += 1;
            startTime = performance.now();
        } else {
            const x = lastOccurrence.get(text[textIndex + patternIndex]) ?? -1;
            const shift = Math.max(1, patternIndex - x);
            textIndex += shift;
        }
    }

    return {
        keyword,
        lastOccurrence,
        searchComparisons,
        matches,
    };
}

export function searchBoyerMooreKeywords(text: string, keywords: readonly string[]): BoyerMooreSearchResult {
  const keywordResults: BoyerMooreKeywordResult[] = [];
  const matches: MatchResult[] = [];
  let comparisons = 0;

  for (const keyword of keywords) {
    const result = searchBoyerMoore(text, keyword);
    
    keywordResults.push(result);
    comparisons += result.searchComparisons;

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