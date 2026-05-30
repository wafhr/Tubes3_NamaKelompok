import { searchKmpKeywords, searchRegex, searchWeightedLevenshteinKeywords } from "../algorithms";
import type { KeywordStats, MatchResult } from "../algorithms";
import { bindTooltip, clearTooltip } from "../content/tooltip";
import { normalizeTextForExactSearch } from "../utils/textNormalizer";
import { nowMs } from "../utils/timer";

const OCR_LANGUAGE = "eng";
const OCR_MAX_IMAGES_PER_SCAN = 16;
const OCR_MIN_IMAGE_WIDTH = 80;
const OCR_MIN_IMAGE_HEIGHT = 40;
const OCR_DETECTED_CLASS = "judol-ocr-detected";
const OCR_BLUR_CLASS = "judol-ocr-blur";
const OCR_DATA_ATTR = "data-judol-ocr-censored";

type TesseractRecognize = (
  image: HTMLImageElement | string,
  language?: string
) => Promise<{ data: { text: string } }>;

interface TesseractModule {
  recognize: TesseractRecognize;
}

export interface OcrImageMatchResult {
  element: HTMLImageElement;
  sourceUrl: string;
  recognizedText: string;
  match: MatchResult;
}

export interface OcrImageScanResult {
  matches: OcrImageMatchResult[];
  scannedImageCount: number;
  detectedImageCount: number;
  comparisons: number;
}

const recognizedTextCache = new Map<string, string>();
let tesseractModulePromise: Promise<TesseractModule> | null = null;

function loadTesseract(): Promise<TesseractModule> {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import("tesseract.js") as Promise<TesseractModule>;
  }

  return tesseractModulePromise;
}

function getImageUrl(image: HTMLImageElement): string {
  return image.currentSrc || image.src;
}

function getImageCacheKey(image: HTMLImageElement): string {
  return `${getImageUrl(image)}|${image.naturalWidth}x${image.naturalHeight}`;
}

function isScannableImage(image: HTMLImageElement): boolean {
  const sourceUrl = getImageUrl(image);

  if (!sourceUrl || sourceUrl.startsWith("chrome-extension://")) {
    return false;
  }

  if (!image.complete || image.naturalWidth < OCR_MIN_IMAGE_WIDTH || image.naturalHeight < OCR_MIN_IMAGE_HEIGHT) {
    return false;
  }

  const rect = image.getBoundingClientRect();

  return rect.width >= OCR_MIN_IMAGE_WIDTH && rect.height >= OCR_MIN_IMAGE_HEIGHT;
}

function collectScannableImages(): HTMLImageElement[] {
  return Array.from(document.images)
    .filter(isScannableImage)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();

      return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
    })
    .slice(0, OCR_MAX_IMAGES_PER_SCAN);
}

function rangesOverlap(left: MatchResult, right: MatchResult): boolean {
  return left.startIndex < right.endIndex && right.startIndex < left.endIndex;
}

function toOcrMatch(match: MatchResult, recognizedText: string): MatchResult {
  return {
    ...match,
    algorithm: "OCR",
    matchedText: recognizedText.slice(match.startIndex, match.endIndex)
  };
}

function addOcrKeywordStats(
  keyStat: KeywordStats,
  matches: readonly MatchResult[],
  executionTimeMs: number
): void {
  const matchCountByKeyword = new Map<string, number>();

  for (const match of matches) {
    const keyword = match.keyword.toLowerCase();
    matchCountByKeyword.set(keyword, (matchCountByKeyword.get(keyword) ?? 0) + 1);
  }

  for (const [keyword, matchCount] of matchCountByKeyword) {
    if (!keyStat.has(keyword)) keyStat.set(keyword, new Map());

    const algoMap = keyStat.get(keyword)!;
    const prevCount = algoMap.get("OCR")?.matchCount ?? 0;
    const prevTime = algoMap.get("OCR")?.executionTimeMs ?? 0;

    algoMap.set("OCR", {
      matchCount: prevCount + matchCount,
      executionTimeMs: prevTime + executionTimeMs
    });
  }
}

function detectOcrTextMatches(
  recognizedText: string,
  keywords: readonly string[]
): { matches: MatchResult[]; comparisons: number } {
  const normalizedText = normalizeTextForExactSearch(recognizedText);
  const tempKeyStat: KeywordStats = new Map();
  const exactResult = searchKmpKeywords(normalizedText, keywords, tempKeyStat);
  const regexMatches = searchRegex(recognizedText, tempKeyStat);
  const fuzzyResult = searchWeightedLevenshteinKeywords(normalizedText, keywords, tempKeyStat);
  const exactRanges = exactResult.matches;
  const fuzzyMatches = fuzzyResult.matches.filter(
    (fuzzyMatch) => !exactRanges.some((exactMatch) => rangesOverlap(fuzzyMatch, exactMatch))
  );
  const matches = [
    ...exactResult.matches.map((match) => toOcrMatch(match, recognizedText)),
    ...regexMatches.map((match) => toOcrMatch(match, recognizedText)),
    ...fuzzyMatches.map((match) => toOcrMatch(match, recognizedText))
  ];

  return {
    matches,
    comparisons: exactResult.comparisons + fuzzyResult.comparisons
  };
}

async function recognizeImageText(image: HTMLImageElement): Promise<string> {
  const cacheKey = getImageCacheKey(image);
  const cachedText = recognizedTextCache.get(cacheKey);

  if (cachedText !== undefined) {
    return cachedText;
  }

  const tesseract = await loadTesseract();
  const result = await tesseract.recognize(image, OCR_LANGUAGE);
  const text = result.data.text.trim();

  recognizedTextCache.set(cacheKey, text);

  return text;
}

export async function scanImagesWithOcr(
  keywords: readonly string[],
  keyStat: KeywordStats
): Promise<OcrImageScanResult> {
  const startTime = nowMs();
  const images = collectScannableImages();
  const matches: OcrImageMatchResult[] = [];
  let comparisons = 0;

  for (const image of images) {
    try {
      const recognizedText = await recognizeImageText(image);

      if (recognizedText.length === 0) {
        continue;
      }

      const result = detectOcrTextMatches(recognizedText, keywords);
      comparisons += result.comparisons;

      for (const match of result.matches) {
        matches.push({
          element: image,
          sourceUrl: getImageUrl(image),
          recognizedText,
          match
        });
      }
    } catch (error) {
      console.warn("[Judol Detector] OCR image skipped", error);
    }
  }

  addOcrKeywordStats(
    keyStat,
    matches.map((match) => match.match),
    nowMs() - startTime
  );

  return {
    matches,
    scannedImageCount: images.length,
    detectedImageCount: new Set(matches.map((match) => match.element)).size,
    comparisons
  };
}

export function clearOcrImageCensorship(): void {
  const censoredImages = document.querySelectorAll<HTMLImageElement>(`img[${OCR_DATA_ATTR}="true"]`);

  censoredImages.forEach((image) => {
    image.classList.remove(OCR_DETECTED_CLASS, OCR_BLUR_CLASS);
    image.removeAttribute(OCR_DATA_ATTR);
    clearTooltip(image);
  });
}

export function applyOcrImageCensorship(
  matches: readonly OcrImageMatchResult[],
  keyStat: KeywordStats
): number {
  const matchesByImage = new Map<HTMLImageElement, MatchResult[]>();

  for (const { element, match } of matches) {
    if (!matchesByImage.has(element)) {
      matchesByImage.set(element, []);
    }

    matchesByImage.get(element)!.push(match);
  }

  for (const [image, imageMatches] of matchesByImage) {
    image.classList.add(OCR_DETECTED_CLASS);
    image.classList.add(OCR_BLUR_CLASS);
    image.setAttribute(OCR_DATA_ATTR, "true");
    bindTooltip(image, imageMatches, keyStat);
  }

  return matchesByImage.size;
}
