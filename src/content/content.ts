import { collectTextNodes } from "./dom";
import type { TextNodeInfo } from "./dom";
import { clearHighlights, highlightMatches} from "./highlighter";
import { setContainerCensorBlur } from "./censor";
import { bindTooltip } from "./tooltip";
import { applyOcrImageCensorship, clearOcrImageCensorship, scanImagesWithOcr } from "../ocr/ocr";
import { searchAhoCorasickKeywords, searchKmpKeywords, searchBoyerMooreKeywords, searchRabinKarpKeywords, searchRegex, searchWeightedLevenshteinKeywords} from "../algorithms";
import type { AlgorithmStats, DomMatchResult, MatchResult, MatchingAlgorithm } from "../algorithms";
import { EXTENSION_NAME, MANUAL_RESCAN_MESSAGE_TYPE } from "../utils/constants";
import { loadKeywords } from "../utils/keywordLoader";
import { getSettings, saveSearchStats } from "../utils/storage";
import type { JudolSettings, StoredSearchStats } from "../utils/storage";
import { measureAsyncExecution, measureExecution } from "../utils/timer";
import { normalizeTextForExactSearch } from "../utils/textNormalizer";

let latestSearchId = 0;

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

interface TextScanSegment {
  node: Text;
  text: string;
  startIndex: number;
}

export function scanTextNodesWithKmp(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[],
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

export function scanTextNodesWithBoyerMoore(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[],
): BoyerMooreDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchBoyerMooreKeywords(normalizedText, keywords);
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
  keywords: readonly string[],
  exactMatches: readonly DomMatchResult[] = []
): WeightedLevenshteinDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;
  const textSegments = collectUnmatchedTextSegments(textNodes, exactMatches);

  for (const segment of textSegments) {
    const normalizedText = normalizeTextForExactSearch(segment.text);
    const result = searchWeightedLevenshteinKeywords(normalizedText, keywords);
    comparisons += result.comparisons;

    for (const match of result.matches) {
      const startIndex = segment.startIndex + match.startIndex;
      const endIndex = segment.startIndex + match.endIndex;
      const sourceText = segment.node.data ?? segment.text;

      matches.push({
        node: segment.node,
        sourceText,
        match: {
          ...match,
          startIndex,
          endIndex,
          matchedText: sourceText.slice(startIndex, endIndex)
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

function collectUnmatchedTextSegments(
  textNodes: readonly TextNodeInfo[],
  exactMatches: readonly DomMatchResult[]
): TextScanSegment[] {
  if (exactMatches.length === 0) {
    return textNodes.map((textNode) => ({
      node: textNode.node,
      text: textNode.text,
      startIndex: 0
    }));
  }

  const exactRangesByNode = new Map<Text, Array<{ startIndex: number; endIndex: number }>>();

  for (const { node, match } of exactMatches) {
    if (!exactRangesByNode.has(node)) {
      exactRangesByNode.set(node, []);
    }

    exactRangesByNode.get(node)!.push({
      startIndex: match.startIndex,
      endIndex: match.endIndex
    });
  }

  const segments: TextScanSegment[] = [];

  for (const textNode of textNodes) {
    const ranges = exactRangesByNode.get(textNode.node);

    if (!ranges || ranges.length === 0) {
      segments.push({
        node: textNode.node,
        text: textNode.text,
        startIndex: 0
      });
      continue;
    }

    const normalizedRanges = ranges
      .map((range) => ({
        startIndex: Math.max(0, Math.min(textNode.text.length, range.startIndex)),
        endIndex: Math.max(0, Math.min(textNode.text.length, range.endIndex))
      }))
      .filter((range) => range.startIndex < range.endIndex)
      .sort((left, right) => left.startIndex - right.startIndex || left.endIndex - right.endIndex);

    let segmentStartIndex = 0;

    for (const range of normalizedRanges) {
      if (range.startIndex > segmentStartIndex) {
        const text = textNode.text.slice(segmentStartIndex, range.startIndex);

        if (text.trim().length > 0) {
          segments.push({
            node: textNode.node,
            text,
            startIndex: segmentStartIndex
          });
        }
      }

      segmentStartIndex = Math.max(segmentStartIndex, range.endIndex);
    }

    if (segmentStartIndex < textNode.text.length) {
      const text = textNode.text.slice(segmentStartIndex);

      if (text.trim().length > 0) {
        segments.push({
          node: textNode.node,
          text,
          startIndex: segmentStartIndex
        });
      }
    }
  }

  return segments;
}

export function scanTextNodesWithAhoCorasick(
  textNodes: readonly TextNodeInfo[],
  keywords: readonly string[],
): AhoCorasickDomScanResult {
  const matches: DomMatchResult[] = [];
  let comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchAhoCorasickKeywords(normalizedText, keywords);
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
): RabinKarpDomScanResult {
  const matches: DomMatchResult[] = [];
  let   comparisons = 0;

  for (const textNode of textNodes) {
    const normalizedText = normalizeTextForExactSearch(textNode.text);
    const result = searchRabinKarpKeywords(normalizedText, keywords);
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
  matches: Array<{ match: MatchResult }>,
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
  const searchId = latestSearchId + 1;
  latestSearchId = searchId;

  clearHighlights();
  clearOcrImageCensorship();

  if (!settings.enabled) {
    setContainerCensorBlur(false);
    await saveSearchStats(window.location.href, buildStoredSearchStats([], createEmptyAlgorithmStats()));
    console.info(`[${EXTENSION_NAME}] search skipped because detection is disabled`);
    return;
  }

  const keywords = await loadKeywords();
  const textNodes = collectTextNodes();
  const algorithmStats = createEmptyAlgorithmStats();
  const { result: kmpResult, executionTimeMs: kmpExecutionTimeMs } = measureExecution(() => scanTextNodesWithKmp(textNodes, keywords));
  const { result: boyerMooreResult, executionTimeMs: boyerMooreExecutionTimeMs } = measureExecution(() => scanTextNodesWithBoyerMoore(textNodes, keywords));
  const { result: regexResult, executionTimeMs: regexExecutionTimeMs } = measureExecution(() => scanTextNodesWithRegex(textNodes));
  const { result: ahoResult, executionTimeMs: ahoExecutionTimeMs } = settings.ahoCorasickEnabled
    ? measureExecution(() => scanTextNodesWithAhoCorasick(textNodes, keywords))
    : {result: null, executionTimeMs: null };
  const { result: rabinKarpResult, executionTimeMs: rabinKarpExecutionTimeMs } = settings.rabinKarpEnabled
    ? measureExecution(() => scanTextNodesWithRabinKarp(textNodes, keywords))
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

  const exactMatches = [
    ...kmpResult.matches,
    ...boyerMooreResult.matches,
    ...(ahoResult?.matches ?? []),
    ...(rabinKarpResult?.matches ?? [])
  ];
  const hasUnmatchedText = collectUnmatchedTextSegments(textNodes, exactMatches).length > 0;

  let fuzzyResult = null;
  let fuzzyExecutionTimeMs = 0;
  if (hasUnmatchedText) {
    const fuzzyExecution = measureExecution(() =>
      scanTextNodesWithWeightedLevenshtein(textNodes, keywords, exactMatches)
    );
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
    console.info(`[${EXTENSION_NAME}] Weighted Levenshtein search skipped because all text was covered by exact matches`);
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

  const wrapperToMatchesMap = highlightMatches(allMatches, settings.blurEnabled);
  for (const [wrapperElement, matches] of wrapperToMatchesMap.entries()) {
    bindTooltip(wrapperElement, matches);
  }

  await saveSearchStats(window.location.href, buildStoredSearchStats(allMatches, algorithmStats));

  if (settings.ocrEnabled) {
    void runOcrScan(searchId, keywords, allMatches, algorithmStats).catch((error: unknown) => {
      console.error(`[${EXTENSION_NAME}] OCR scan failed`, error);
    });
  }
}

async function runOcrScan(
  searchId: number,
  keywords: readonly string[],
  textMatches: readonly DomMatchResult[],
  algorithmStats: Partial<Record<MatchingAlgorithm, AlgorithmStats>>
): Promise<void> {
  const { result: ocrResult, executionTimeMs: ocrExecutionTimeMs } = await measureAsyncExecution(() =>
    scanImagesWithOcr(keywords)
  );

  if (searchId !== latestSearchId) {
    return;
  }

  const ocrDetectedImageCount = applyOcrImageCensorship(ocrResult.matches);
  const ocrMatches: Array<{ match: MatchResult }> = ocrResult.matches;
  const updatedAlgorithmStats = {
    ...algorithmStats
  };

  addAlgorithmStats(updatedAlgorithmStats, "OCR", ocrResult.matches.length, ocrExecutionTimeMs, ocrResult.comparisons);
  await saveSearchStats(window.location.href, buildStoredSearchStats([...textMatches, ...ocrMatches], updatedAlgorithmStats));

  console.info(
    `[${EXTENSION_NAME}] OCR scan finished: ${ocrResult.detectedImageCount} detected images, ${ocrResult.scannedImageCount} scanned images, ${ocrDetectedImageCount} censored images, scan ${ocrExecutionTimeMs.toFixed(2)} ms`
  );
}

async function initializeExtension(): Promise<void> {
  let currentSettings = await getSettings();
  let isSearchRunning = false;
  let rerunAfterCurrentSearch = false;

  const runControlledSearch = async (reason: string): Promise<void> => {
    if (isSearchRunning) {
      rerunAfterCurrentSearch = true;
      return;
    }

    isSearchRunning = true;

    try {
      do {
        rerunAfterCurrentSearch = false;
        console.info(`[${EXTENSION_NAME}] search started: ${reason}`);
        await runSearch(currentSettings);
      } while (rerunAfterCurrentSearch);
    } finally {
      isSearchRunning = false;
    }
  };

  await runControlledSearch("initial load");

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.judolSettings?.newValue) {
      return;
    }

    currentSettings = changes.judolSettings.newValue as JudolSettings;
    setContainerCensorBlur(currentSettings.enabled && currentSettings.blurEnabled);

    void runControlledSearch("settings changed").catch((error: unknown) => {
      console.error(`[${EXTENSION_NAME}] rescan failed`, error);
    });
  });

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (
      typeof message !== "object" ||
      message === null ||
      (message as { type?: unknown }).type !== MANUAL_RESCAN_MESSAGE_TYPE
    ) {
      return false;
    }

    void getSettings()
      .then((settings) => {
        currentSettings = settings;
        return runControlledSearch("manual rescan");
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => {
        console.error(`[${EXTENSION_NAME}] manual rescan failed`, error);
        sendResponse({ ok: false });
      });

    return true;
  });
}

void initializeExtension().catch((error: unknown) => {
  console.error(`[${EXTENSION_NAME}] initialization failed`, error);
});
