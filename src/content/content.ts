import { collectTextNodes } from "./dom";
import type { TextNodeInfo } from "./dom";
import { clearHighlights, highlightMatches} from "./highlighter";
import { setContainerCensorBlur } from "./censor";
import { searchAhoCorasickKeywords, searchKmpKeywords, searchBoyerMooreKeywords, searchRabinKarpKeywords, searchRegex, searchWeightedLevenshteinKeywords} from "../algorithms";
import type { AlgorithmStats, KeywordStats, DomMatchResult, MatchingAlgorithm } from "../algorithms";
import { EXTENSION_NAME } from "../utils/constants";
import { loadKeywords } from "../utils/keywordLoader";
import { getSettings, saveSearchStats } from "../utils/storage";
import type { JudolSettings, StoredSearchStats } from "../utils/storage";
import { measureExecution } from "../utils/timer";
import { normalizeTextForExactSearch } from "../utils/textNormalizer";

export interface KmpDomScanResult {
  matches: DomMatchResult[];
  comparisons: number;
  scannedNodeCount: number;
}

export interface BoyerMooreDomScanResult {
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

export interface AhoCorasickDomScanResult {
  matches: DomMatchResult[];
  comparisons: number;
  scannedNodeCount: number;
}

export interface RabinKarpDomScanResult {
  matches: DomMatchResult[];
  comparisons: number;
  scannedNodeCount: number;
}

export function scanTextNodesWithKmp(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[],
  keyStat: KeywordStats
): KmpDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchKmpKeywords(normalizedText, keywords, keyStat);
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

export function scanTextNodesWithBoyerMoore(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[],
  keyStat: KeywordStats
): BoyerMooreDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchBoyerMooreKeywords(normalizedText, keywords, keyStat);
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

export function scanTextNodesWithRegex(textNodes: readonly TextNodeInfo[], keyStat: KeywordStats): RegexDomScanResult {
  const matches: DomMatchResult[] = [];

  for (const textNode of textNodes) {
    const regexMatches = searchRegex(textNode.text, keyStat);

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
  keywords: readonly string[],
  keyStat: KeywordStats
): WeightedLevenshteinDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchWeightedLevenshteinKeywords(normalizedText, keywords, keyStat);
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

export function scanTextNodesWithAhoCorasick(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[],
  keyStat: KeywordStats
): AhoCorasickDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchAhoCorasickKeywords(normalizedText, keywords, keyStat);
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

export function scanTextNodesWithRabinKarp(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[],
  keyStat: KeywordStats
): RabinKarpDomScanResult {
  const matches: DomMatchResult[] = [];
  let   comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchRabinKarpKeywords(normalizedText, keywords, keyStat);
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

function createEmptyAlgorithmStats(): Partial<Record<MatchingAlgorithm, AlgorithmStats>> {
  return {};
}

function addAlgorithmStats(
  stats: Partial<Record<MatchingAlgorithm, AlgorithmStats>>,
  algorithm: MatchingAlgorithm,
  matchCount: number,
  executionTimeMs: number,
  comparisons: number
): void {
  stats[algorithm] = {
    algorithm,
    executionTimeMs,
    matchCount,
    comparisons
  };
}

function buildStoredSearchStats(
  matches: readonly DomMatchResult[],
  algorithmStats: Partial<Record<MatchingAlgorithm, AlgorithmStats>>
): StoredSearchStats {
  const keywordCounts = new Map<string, number>();

  for (const { match } of matches) {
    keywordCounts.set(match.keyword, (keywordCounts.get(match.keyword) ?? 0) + 1);
  }

  return {
    searchedAt: Date.now(),
    url: window.location.href,
    totalKeywordsFound: keywordCounts.size,
    totalMatches: matches.length,
    keywordCounts: Array.from(keywordCounts.entries())
      .map(([keyword, matchCount]) => ({ keyword, matchCount }))
      .sort((left, right) => right.matchCount - left.matchCount || left.keyword.localeCompare(right.keyword)),
    algorithmStats
  };
}

async function runSearch(settings: JudolSettings): Promise<void> {
  clearHighlights();

  const keywords = await loadKeywords();
  const textNodes = collectTextNodes();
  const keyStat: KeywordStats = new Map();
  const algorithmStats = createEmptyAlgorithmStats();
  const { result: kmpResult, executionTimeMs: kmpExecutionTimeMs } = measureExecution(() => scanTextNodesWithKmp(textNodes, keywords, keyStat));
  const { result: boyerMooreResult, executionTimeMs: boyerMooreExecutionTimeMs } = measureExecution(() => scanTextNodesWithBoyerMoore(textNodes, keywords, keyStat));
  const { result: regexResult, executionTimeMs: regexExecutionTimeMs } = measureExecution(() => scanTextNodesWithRegex(textNodes, keyStat));
  const { result: ahoResult, executionTimeMs: ahoExecutionTimeMs } = settings.ahoCorasickEnabled
    ? measureExecution(() => scanTextNodesWithAhoCorasick(textNodes, keywords, keyStat))
    : {result: null, executionTimeMs: null };
  const { result: rabinKarpResult, executionTimeMs: rabinKarpExecutionTimeMs } = settings.rabinKarpEnabled
    ? measureExecution(() => scanTextNodesWithRabinKarp(textNodes, keywords, keyStat))
    : {result: null, executionTimeMs: null };

  addAlgorithmStats(algorithmStats, "KMP", kmpResult.matches.length, kmpExecutionTimeMs, kmpResult.comparisons);
  addAlgorithmStats(
    algorithmStats,
    "Boyer-Moore",
    boyerMooreResult.matches.length,
    boyerMooreExecutionTimeMs,
    boyerMooreResult.comparisons
  );
  addAlgorithmStats(algorithmStats, "Regex", regexResult.matches.length, regexExecutionTimeMs, regexResult.comparisons);

  if (ahoResult) {
    addAlgorithmStats(
      algorithmStats,
      "Aho-Corasick",
      ahoResult.matches.length,
      ahoExecutionTimeMs,
      ahoResult.comparisons
    );
  }
  
  if (rabinKarpResult) {
    addAlgorithmStats(
      algorithmStats,
      "Rabin-Karp",
      rabinKarpResult.matches.length,
      rabinKarpExecutionTimeMs,
      rabinKarpResult.comparisons
    );
  }

  const totalExactMatches = 
    kmpResult.matches.length + 
    boyerMooreResult.matches.length + 
    (ahoResult?.matches?.length ?? 0) + 
    (rabinKarpResult?.matches?.length ?? 0);

  let fuzzyResult = null;
  let fuzzyExecutionTimeMs = 0;
  if (totalExactMatches === 0) {
    const fuzzyExecution = measureExecution(() => scanTextNodesWithWeightedLevenshtein(textNodes, keywords, keyStat));
    fuzzyResult = fuzzyExecution.result;
    fuzzyExecutionTimeMs = fuzzyExecution.executionTimeMs;

    addAlgorithmStats(
      algorithmStats,
      "Weighted Levenshtein",
      fuzzyResult.matches.length,
      fuzzyExecutionTimeMs,
      fuzzyResult.comparisons
    );
    console.info(`[${EXTENSION_NAME}] Weighted Levenshtein search finished: ${fuzzyResult.matches.length} matches, execTime ${fuzzyExecutionTimeMs.toFixed(3)} ms`);
  } else {
    console.info(`[${EXTENSION_NAME}] Weighted Levenshtein search skipped because exact matches were found`);
  }

  console.info(
    `[${EXTENSION_NAME}] KMP search finished: ${kmpResult.matches.length} matches, ${keywords.length} keywords, ${kmpResult.scannedNodeCount} text nodes, ${kmpResult.comparisons} comparisons, execTime: ${kmpExecutionTimeMs.toFixed(3)} ms`
  );

  console.info(
    `[${EXTENSION_NAME}] BoyerMoore search finished: ${boyerMooreResult.matches.length} matches, ${keywords.length} keywords, ${boyerMooreResult.scannedNodeCount} text nodes, ${boyerMooreResult.comparisons} comparisons, execTime: ${boyerMooreExecutionTimeMs.toFixed(3)} ms`
  );

  console.info(
    `[${EXTENSION_NAME}] Regex search finished: ${regexResult.matches.length} matches, ${regexResult.scannedNodeCount} text nodes, ${regexResult.comparisons} comparisons, execTime: ${regexExecutionTimeMs.toFixed(3)} ms`
  );

  const allMatches = [
    ...kmpResult.matches,
    ...boyerMooreResult.matches,
    ...regexResult.matches,
    ...(ahoResult?.matches ?? []),
    ...(rabinKarpResult?.matches ?? []),
    ...(fuzzyResult?.matches ?? [])
  ];

  const highlightedCount = highlightMatches(allMatches, keyStat, settings.blurEnabled);
  await saveSearchStats(buildStoredSearchStats(allMatches, algorithmStats));

  console.info(`[${EXTENSION_NAME}] highlighted ${highlightedCount} DOM matches`);
}

async function initializeExtension(): Promise<void> {
  const settings = await getSettings();
  await runSearch(settings);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.judolSettings?.newValue) {
      return;
    }

    const nextSettings = changes.judolSettings.newValue as JudolSettings;
    setContainerCensorBlur(nextSettings.blurEnabled);

    void runSearch(nextSettings).catch((error: unknown) => {
      console.error(`[${EXTENSION_NAME}] rescan failed`, error);
    });
  });
}

void initializeExtension().catch((error: unknown) => {
  console.error(`[${EXTENSION_NAME}] initialization failed`, error);
});
