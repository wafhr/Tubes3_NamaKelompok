import type { MatchResult } from "./types";

const INSERTION_COST = 1;
const DELETION_COST = 1;
const NORMAL_SUBSTITUTION_COST = 1;
const VISUALLY_SIMILAR_SUBSTITUTION_COST = 0.25;
const DEFAULT_SIMILARITY_THRESHOLD = 0.8;

interface WeightedDistanceResult {
  distance: number;
  comparisons: number;
}

interface TextToken {
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface WeightedLevenshteinSearchResult {
  matches: MatchResult[];
  comparisons: number;
}

const VISUALLY_SIMILAR_GROUPS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(["a", "4", "@", "\u03b1"]),
  new Set(["o", "0"]),
  new Set(["i", "1", "l", "|", "!"]),
  new Set(["l", "1", "i", "|"]),
  new Set(["s", "5", "$"]),
  new Set(["e", "3"]),
  new Set(["g", "6", "9"]),
  new Set(["t", "7"])
];

function toComparableCharacters(text: string): string[] {
  return Array.from(text.toLowerCase());
}

function areVisuallySimilar(a: string, b: string): boolean {
  for (const group of VISUALLY_SIMILAR_GROUPS) {
    if (group.has(a) && group.has(b)) {
      return true;
    }
  }

  return false;
}

function isAsciiDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function isAsciiLetter(character: string): boolean {
  const lowerCharacter = character.toLowerCase();

  return lowerCharacter >= "a" && lowerCharacter <= "z";
}

function isVisualSubstitutionSymbol(character: string): boolean {
  return character === "@" || character === "$" || character === "|" || character === "!";
}

function isTokenCharacter(character: string): boolean {
  return isAsciiLetter(character) || isAsciiDigit(character) || isVisualSubstitutionSymbol(character) || character === "\u03b1";
}

function tokenizeText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let currentTokenStart = -1;
  let currentTokenCharacters: string[] = [];
  let index = 0;

  while (index < text.length) {
    const codePoint = text.codePointAt(index);

    if (codePoint === undefined) {
      break;
    }

    const character = String.fromCodePoint(codePoint);

    if (isTokenCharacter(character)) {
      if (currentTokenStart === -1) {
        currentTokenStart = index;
      }

      currentTokenCharacters.push(character);
    } else if (currentTokenStart !== -1) {
      tokens.push({
        text: currentTokenCharacters.join(""),
        startIndex: currentTokenStart,
        endIndex: index
      });

      currentTokenStart = -1;
      currentTokenCharacters = [];
    }

    index += character.length;
  }

  if (currentTokenStart !== -1) {
    tokens.push({
      text: currentTokenCharacters.join(""),
      startIndex: currentTokenStart,
      endIndex: text.length
    });
  }

  return tokens;
}

function joinTokenTexts(tokens: readonly TextToken[], startIndex: number, tokenCount: number): string {
  let joinedText = "";

  for (let offset = 0; offset < tokenCount; offset += 1) {
    if (offset > 0) {
      joinedText += " ";
    }

    joinedText += tokens[startIndex + offset].text;
  }

  return joinedText;
}

function getAllowedLengthDifference(keywordLength: number): number {
  return Math.max(1, Math.floor(keywordLength * 0.25));
}

function hasNearbyLength(keyword: string, candidate: string): boolean {
  const keywordLength = toComparableCharacters(keyword).length;
  const candidateLength = toComparableCharacters(candidate).length;
  const difference = Math.abs(keywordLength - candidateLength);

  return difference <= getAllowedLengthDifference(keywordLength);
}

function calculateSimilarityFromDistance(distance: number, maxLength: number): number {
  if (maxLength === 0) {
    return 1;
  }

  const similarity = 1 - distance / maxLength;

  return Math.max(0, Math.min(1, similarity));
}

function computeWeightedLevenshteinDistance(a: string, b: string): WeightedDistanceResult {
  const source = toComparableCharacters(a);
  const target = toComparableCharacters(b);
  let comparisons = 0;

  let previousRow: number[] = new Array(target.length + 1);
  let currentRow: number[] = new Array(target.length + 1);

  for (let column = 0; column <= target.length; column += 1) {
    previousRow[column] = column * INSERTION_COST;
  }

  for (let row = 1; row <= source.length; row += 1) {
    currentRow[0] = row * DELETION_COST;

    for (let column = 1; column <= target.length; column += 1) {
      comparisons += 1;

      const deletion = previousRow[column] + DELETION_COST;
      const insertion = currentRow[column - 1] + INSERTION_COST;
      const substitution = previousRow[column - 1] + getSubstitutionCost(source[row - 1], target[column - 1]);

      currentRow[column] = Math.min(deletion, insertion, substitution);
    }

    const finishedRow = previousRow;
    previousRow = currentRow;
    currentRow = finishedRow;
  }

  return {
    distance: previousRow[target.length],
    comparisons
  };
}

export function getSubstitutionCost(a: string, b: string): number {
  const [leftCharacter = ""] = toComparableCharacters(a);
  const [rightCharacter = ""] = toComparableCharacters(b);

  if (leftCharacter === rightCharacter) {
    return 0;
  }

  if (areVisuallySimilar(leftCharacter, rightCharacter)) {
    return VISUALLY_SIMILAR_SUBSTITUTION_COST;
  }

  return NORMAL_SUBSTITUTION_COST;
}

export function weightedLevenshteinDistance(a: string, b: string): number {
  return computeWeightedLevenshteinDistance(a, b).distance;
}

export function calculateSimilarity(a: string, b: string): number {
  const maxLength = Math.max(toComparableCharacters(a).length, toComparableCharacters(b).length);
  const { distance } = computeWeightedLevenshteinDistance(a, b);

  return calculateSimilarityFromDistance(distance, maxLength);
}

export function isFuzzyMatch(
  keyword: string,
  candidate: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): boolean {
  if (keyword.length === 0 || candidate.length === 0) {
    return false;
  }

  return calculateSimilarity(keyword, candidate) >= threshold;
}

export function searchWeightedLevenshteinKeywords(
  text: string,
  keywords: readonly string[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): WeightedLevenshteinSearchResult {
  const textTokens = tokenizeText(text);
  const matches: MatchResult[] = [];
  let comparisons = 0;

  for (const keyword of keywords) {
    const keywordTokens = tokenizeText(keyword);
    const tokenCount = keywordTokens.length;

    if (tokenCount === 0 || tokenCount > textTokens.length) {
      continue;
    }

    const comparableKeyword = joinTokenTexts(keywordTokens, 0, tokenCount);

    let startTime = performance.now();

    for (let tokenIndex = 0; tokenIndex <= textTokens.length - tokenCount; tokenIndex += 1) {
      const comparableCandidate = joinTokenTexts(textTokens, tokenIndex, tokenCount);

      if (!hasNearbyLength(comparableKeyword, comparableCandidate)) {
        continue;
      }

      const { distance, comparisons: distanceComparisons } = computeWeightedLevenshteinDistance(
        comparableKeyword,
        comparableCandidate
      );
      comparisons += distanceComparisons;

      const maxLength = Math.max(
        toComparableCharacters(comparableKeyword).length,
        toComparableCharacters(comparableCandidate).length
      );
      const similarity = calculateSimilarityFromDistance(distance, maxLength);

      if (similarity >= threshold) {
        const startIndex = textTokens[tokenIndex].startIndex;
        const endIndex = textTokens[tokenIndex + tokenCount - 1].endIndex;
        
        const endTime = performance.now();
        const segmentDuration = endTime - startTime;

        matches.push({
          keyword,
          algorithm: "Weighted Levenshtein",
          startIndex,
          endIndex,
          matchedText: text.slice(startIndex, endIndex),
          comparisons: distanceComparisons,
          searchTime: segmentDuration
        });

        startTime = performance.now();
      }
    }
  }

  return {
    matches,
    comparisons
  };
}
