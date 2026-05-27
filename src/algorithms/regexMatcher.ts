import type { MatchResult } from "./types";

const WORD_WITH_DIGITS_PATTERN = /(?<![\p{L}\p{N}_])\p{L}[\p{L}\p{M}]{3,}\p{N}{2,}(?![\p{L}\p{N}_])/gu;

export function searchRegex(text: string): MatchResult[] {
  const matches: MatchResult[] = [];

  WORD_WITH_DIGITS_PATTERN.lastIndex = 0;

  let regexMatch = WORD_WITH_DIGITS_PATTERN.exec(text);
  while (regexMatch !== null) {
    const matchedText = regexMatch[0];
    const startIndex = regexMatch.index;
    const endIndex = startIndex + matchedText.length;

    matches.push({
      keyword: matchedText,
      algorithm: "Regex",
      startIndex,
      endIndex,
      matchedText,
      comparisons: 0
    });

    regexMatch = WORD_WITH_DIGITS_PATTERN.exec(text);
  }

  return matches;
}
