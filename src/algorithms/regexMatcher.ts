import type { KeywordStats, MatchResult } from "./types";
import { measureExecution } from "../utils/timer";

const WORD_WITH_DIGITS_PATTERN = /(?<![\p{L}\p{N}_])\p{L}[\p{L}\p{M}]*\p{N}{2,}(?![\p{L}\p{N}_])/gu;

function findRegexMatches(text: string): MatchResult[] {
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

export function searchRegex(text: string, keyStat: KeywordStats): MatchResult[] {
  const { result: matches, executionTimeMs: execTime } = measureExecution(() => findRegexMatches(text));

  // tambah keyStat
  if (matches.length > 0) {
    const algoKey = "Regex";
    const matchCountByKeyword = new Map<string, number>();

    for (const match of matches) {
      matchCountByKeyword.set(match.keyword, (matchCountByKeyword.get(match.keyword) ?? 0) + 1);
    }

    for (const [keyword, matchCount] of matchCountByKeyword) {
      if (!keyStat.has(keyword)) keyStat.set(keyword, new Map());

      const algoMap = keyStat.get(keyword)!;
      const prevCount = algoMap.get(algoKey)?.matchCount ?? 0;
      const prevTime = algoMap.get(algoKey)?.executionTimeMs ?? 0;

      algoMap.set(algoKey, {
        matchCount: prevCount + matchCount,
        executionTimeMs: prevTime + execTime
      });
    }
  }

  return matches;
}
