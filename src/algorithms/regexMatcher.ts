import type { MatchResult } from "./types";

const WORD_WITH_DIGITS_PATTERN = /(?<![\p{L}\p{N}_])\p{L}[\p{L}\p{M}]*\p{N}{2,}(?![\p{L}\p{N}_])/gu;

export function searchRegex(text: string): MatchResult[] {
  const matches: MatchResult[] = [];

  WORD_WITH_DIGITS_PATTERN.lastIndex = 0;

  let startTime = performance.now();
  let regexMatch = WORD_WITH_DIGITS_PATTERN.exec(text);

  while (regexMatch !== null) {
    const matchedText = regexMatch[0];
    const startIndex = regexMatch.index;
    const endIndex = startIndex + matchedText.length;

    const endTime = performance.now();
    const segmentDuration = endTime - startTime;

    matches.push({
      keyword: matchedText,
      algorithm: "Regex",
      startIndex,
      endIndex,
      matchedText,
      comparisons: 0,
      searchTime: segmentDuration
    });

    startTime = performance.now();
    regexMatch = WORD_WITH_DIGITS_PATTERN.exec(text);
  }

  return matches;
}
