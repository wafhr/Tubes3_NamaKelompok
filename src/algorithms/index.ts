export {
  buildKmpLpsTable,
  searchKmp,
  searchKmpKeywords,
  type KmpKeywordResult,
  type KmpSearchResult
} from "./kmp";
export {
  searchRabinKarp,
  searchRabinKarpKeywords,
  type RabinKarpKeywordResult,
  type RabinKarpSearchResult
} from "./rabinKarp";
export { searchRegex } from "./regexMatcher";
export type { AlgorithmStats, MatchResult, MatchingAlgorithm } from "./types";
export {
  calculateSimilarity,
  getSubstitutionCost,
  isFuzzyMatch,
  searchWeightedLevenshteinKeywords,
  weightedLevenshteinDistance
} from "./weightedLevenshtein";
export type { WeightedLevenshteinSearchResult } from "./weightedLevenshtein";