import { collectTextNodes } from "./dom";
import type { TextNodeInfo } from "./dom";
import { searchKmpKeywords, searchRegex, searchWeightedLevenshteinKeywords } from "../algorithms";
import type { MatchResult } from "../algorithms";
import { EXTENSION_NAME } from "../utils/constants";
import { loadKeywords } from "../utils/keywordLoader";
import { measureExecution } from "../utils/timer";
import { normalizeTextForExactSearch } from "../utils/textNormalizer";

export interface DomMatchResult {
  node: Text;
  sourceText: string;
  match: MatchResult;
}

export interface KmpDomScanResult {
  matches: DomMatchResult[];
  comparisons: number;
  scannedNodeCount: number;
}

export interface RegexDomScanResult {
  matches: DomMatchResult[];
  comparisons: number;
  scannedNodeCount: number;
}

export interface WeightedLevenshteinDomScanResult {
  matches: DomMatchResult[];
  comparisons: number;
  scannedNodeCount: number;
}

export function scanTextNodesWithKmp(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[]
): KmpDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchKmpKeywords(normalizedText, keywords);
    comparisons += result.comparisons;

    for (const match of result.matches) {
      matches.push({
        node: textNode.node,
        sourceText: textNode.text,
        match: {
          ...match,
          matchedText: textNode.text.slice(match.startIndex, match.endIndex)
        }
      });
    }
  }

  return {
    matches,
    comparisons,
    scannedNodeCount: textNodes.length
  };
}

export function scanTextNodesWithRegex(textNodes: readonly TextNodeInfo[]): RegexDomScanResult {
  const matches: DomMatchResult[] = [];

  for (const textNode of textNodes) {
    const regexMatches = searchRegex(textNode.text);

    for (const match of regexMatches) {
      matches.push({
        node: textNode.node,
        sourceText: textNode.text,
        match
      });
    }
  }

  return {
    matches,
    comparisons: 0,
    scannedNodeCount: textNodes.length
  };
}

export function scanTextNodesWithWeightedLevenshtein(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[]
): WeightedLevenshteinDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchWeightedLevenshteinKeywords(normalizedText, keywords);
    comparisons += result.comparisons;

    for (const match of result.matches) {
      matches.push({
        node: textNode.node,
        sourceText: textNode.text,
        match: {
          ...match,
          matchedText: textNode.text.slice(match.startIndex, match.endIndex)
        }
      });
    }
  }

  return {
    matches,
    comparisons,
    scannedNodeCount: textNodes.length
  };
}

async function initializeExtension(): Promise<void> {
  const keywords = await loadKeywords();
  const textNodes = collectTextNodes();
  const { result: kmpResult, executionTimeMs: kmpExecutionTimeMs } = measureExecution(() => scanTextNodesWithKmp(textNodes, keywords));
  const { result: regexResult, executionTimeMs: regexExecutionTimeMs } = measureExecution(() => scanTextNodesWithRegex(textNodes));
  const { result: fuzzyResult, executionTimeMs: fuzzyExecutionTimeMs } = measureExecution(() =>
    scanTextNodesWithWeightedLevenshtein(textNodes, keywords)
  );

  console.info(
    `[${EXTENSION_NAME}] KMP scan finished: ${kmpResult.matches.length} matches, ${keywords.length} keywords, ${kmpResult.scannedNodeCount} text nodes, ${kmpResult.comparisons} comparisons, scan ${kmpExecutionTimeMs.toFixed(2)} ms`
  );

  console.info(
    `[${EXTENSION_NAME}] Regex scan finished: ${regexResult.matches.length} matches, ${regexResult.scannedNodeCount} text nodes, ${regexResult.comparisons} comparisons, scan ${regexExecutionTimeMs.toFixed(2)} ms`
  );

  console.info(
    `[${EXTENSION_NAME}] Weighted Levenshtein scan finished: ${fuzzyResult.matches.length} matches, ${keywords.length} keywords, ${fuzzyResult.scannedNodeCount} text nodes, ${fuzzyResult.comparisons} comparisons, scan ${fuzzyExecutionTimeMs.toFixed(2)} ms`
  );
}

void initializeExtension().catch((error: unknown) => {
  console.error(`[${EXTENSION_NAME}] initialization failed`, error);
});
