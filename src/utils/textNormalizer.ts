import { EMPTY_TEXT } from "./constants";

export function normalizeKeyword(keyword: string): string {
  return keyword
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, EMPTY_TEXT)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeTextForExactSearch(text: string): string {
  return text.toLowerCase();
}

export function isBlankText(text: string): boolean {
  return text.trim().length === 0;
}
