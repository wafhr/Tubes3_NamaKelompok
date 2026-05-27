export {
  buildKmpLpsTable,
  searchKmp,
  searchKmpKeywords,
  type KmpKeywordResult,
  type KmpSearchResult
} from "./kmp";
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