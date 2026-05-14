import { KEYWORD_FILE_PATH } from "./constants";
import { normalizeKeyword } from "./textNormalizer";

function getKeywordUrl(): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(KEYWORD_FILE_PATH);
  }

  return `/${KEYWORD_FILE_PATH}`;
}

export async function loadKeywords(): Promise<string[]> {
  const response = await fetch(getKeywordUrl());

  if (!response.ok) {
    throw new Error(`Failed to load keywords: ${response.status}`);
  }

  const rawText = await response.text();

  return rawText
    .split(/\r?\n/)
    .map((line) => normalizeKeyword(line))
    .filter((keyword) => keyword.length > 0);
}
