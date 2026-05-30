import { searchKmpKeywords, searchRegex, searchWeightedLevenshteinKeywords } from "../algorithms";
import type { MatchResult } from "../algorithms";
import { bindTooltip, clearTooltip } from "../content/tooltip";
import { OCR_FETCH_IMAGE_MESSAGE_TYPE } from "../utils/constants";
import { normalizeTextForExactSearch } from "../utils/textNormalizer";
import { nowMs } from "../utils/timer";

const OCR_LANGUAGE = "eng";
const OCR_MAX_IMAGES_PER_SCAN = 16;
const OCR_MIN_IMAGE_WIDTH = 80;
const OCR_MIN_IMAGE_HEIGHT = 40;
const OCR_DETECTED_CLASS = "judol-ocr-detected";
const OCR_BLUR_CLASS = "judol-ocr-blur";
const OCR_DATA_ATTR = "data-judol-ocr-censored";
const OCR_DEBUG_LOGGING = false;

type TesseractRecognize = (
  image: HTMLImageElement | Blob | string,
  language?: string
) => Promise<{ data: { text: string } }>;

interface TesseractModule {
  recognize: TesseractRecognize;
}

interface OcrFetchImageResponse {
  ok?: boolean;
  dataUrl?: string;
  error?: string;
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

function shouldFetchImageViaBackground(imageUrl: string): boolean {
  return imageUrl.startsWith("http://") || imageUrl.startsWith("https://");
}

async function fetchImageDataUrlViaBackground(url: string): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    type: OCR_FETCH_IMAGE_MESSAGE_TYPE,
    url
  }) as OcrFetchImageResponse | undefined;

  if (!response?.ok || !response.dataUrl) {
    throw new Error(response?.error ?? "Background image fetch failed");
  }

  return response.dataUrl;
}

function loadImageFromSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode OCR image"));
    image.src = source;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode OCR image as PNG"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

async function convertImageToPngBlob(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");

  if (!context || width === 0 || height === 0) {
    throw new Error("Failed to prepare fetched OCR image");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0);

  return canvasToPngBlob(canvas);
}

async function createOcrInputBlob(image: HTMLImageElement): Promise<Blob> {
  const imageUrl = getImageUrl(image);

  if (shouldFetchImageViaBackground(imageUrl)) {
    const dataUrl = await fetchImageDataUrlViaBackground(imageUrl);
    const fetchedImage = await loadImageFromSource(dataUrl);

    return convertImageToPngBlob(fetchedImage);
  }

  return convertImageToPngBlob(image);
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
    .slice(0, OCR_MAX_IMAGES_PER_SCAN);
}

function rangesOverlap(left: MatchResult, right: MatchResult): boolean {
  return left.startIndex < right.endIndex && right.startIndex < left.endIndex;
}

function toOcrMatch(match: MatchResult, recognizedText: string): MatchResult {
  return {
    ...match,
    algorithm: "OCR",
    matchedText: recognizedText.slice(match.startIndex, match.endIndex),
    searchTime: match.searchTime
  };
}

function detectOcrTextMatches(
  recognizedText: string,
  keywords: readonly string[]
): { matches: MatchResult[]; comparisons: number } {
  const normalizedText = normalizeTextForExactSearch(recognizedText);
  
  const exactResult = searchKmpKeywords(normalizedText, keywords); 
  const regexMatches = searchRegex(recognizedText); 
  const fuzzyResult = searchWeightedLevenshteinKeywords(normalizedText, keywords); 

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
  const ocrInput = await createOcrInputBlob(image);
  const result = await tesseract.recognize(ocrInput, OCR_LANGUAGE);

  const text = result.data.text.trim();

  recognizedTextCache.set(cacheKey, text);
  return text;
}

export async function scanImagesWithOcr(keywords: readonly string[]): Promise<OcrImageScanResult> {
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
      if (OCR_DEBUG_LOGGING) {
        console.warn("[Judol Detector] OCR image skipped", error);
      }
    }
  }

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

export function applyOcrImageCensorship(matches: readonly OcrImageMatchResult[]): number {
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
    bindTooltip(image, imageMatches);
  }

  return matchesByImage.size;
}
