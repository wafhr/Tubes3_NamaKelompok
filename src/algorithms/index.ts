export {
  buildAhoCorasickAutomaton,
  searchAhoCorasickKeywords,
  type AhoCorasickAutomaton,
  type AhoCorasickSearchResult
} from "./ahoCorasick";
export {
  buildKmpLpsTable,
  searchKmp,
  searchKmpKeywords,
  type KmpKeywordResult,
  type KmpSearchResult
} from "./kmp";
export {
  searchBoyerMoore,
  searchBoyerMooreKeywords,
  type BoyerMooreKeywordResult,
  type BoyerMooreSearchResult
} from "./boyerMoore";
export {
  searchRabinKarp,
  searchRabinKarpKeywords,
  type RabinKarpKeywordResult,
  type RabinKarpSearchResult
} from "./rabinKarp";
export { searchRegex } from "./regexMatcher";
export type { AlgorithmStats, KeywordStats, MatchResult, MatchingAlgorithm, DomMatchResult} from "./types";
export {
  calculateSimilarity,
  getSubstitutionCost,
  isFuzzyMatch,
  searchWeightedLevenshteinKeywords,
  weightedLevenshteinDistance
} from "./weightedLevenshtein";
export type { WeightedLevenshteinSearchResult } from "./weightedLevenshtein";
