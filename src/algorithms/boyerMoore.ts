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

    let textIndex = n - 1;
    let patternIndex = n - 1;
    let searchComparisons = 0;

    while (textIndex < text.length) {
        searchComparisons++;
        
        if (text[textIndex] === keyword[patternIndex]) {
            textIndex--;
            patternIndex--;
        
            if (patternIndex === -1) {
                const startIndex = textIndex + 1;
                const endIndex = textIndex + n;  

                matches.push({
                keyword,
                algorithm: "Boyer-Moore",
                startIndex,
                endIndex,
                matchedText: text.slice(startIndex, endIndex),
                comparisons: searchComparisons
                });

                textIndex += endIndex + 1;
                patternIndex = n - 1;
            }
        }else{
            const x = lastOccurrence.get(text[textIndex]) ?? -1;
            textIndex += n - Math.min(patternIndex, 1 + x);
            patternIndex = n - 1;
        }
    }
    return {
        keyword,
        lastOccurrence,
        searchComparisons,
        matches
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