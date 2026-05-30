export type MatchingAlgorithm =
  | "KMP"
  | "Boyer-Moore"
  | "Regex"
  | "Weighted Levenshtein"
  | "Aho-Corasick"
  | "Rabin-Karp"
  | "OCR";

export interface MatchResult {
  keyword: string;
  algorithm: MatchingAlgorithm;
  startIndex: number;
  endIndex: number;
  matchedText: string;
  comparisons: number;
  searchTime: number;
}

export interface AlgorithmStats {
  algorithm: MatchingAlgorithm;
  executionTimeMs: number;
  matchCount: number;
  comparisons: number;
}

export interface DomMatchResult {
  node: Text;
  sourceText: string;
  match: MatchResult;
}