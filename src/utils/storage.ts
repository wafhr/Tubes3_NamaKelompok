import type { MatchingAlgorithm } from "../algorithms";

export const SEARCH_STATS_STORAGE_KEY = "judolSearchStats";
export const SETTINGS_STORAGE_KEY = "judolSettings";

export interface StoredAlgorithmStat {
  matchCount: number;
  executionTimeMs: number;
  comparisons: number;
}

export interface StoredKeywordStat {
  keyword: string;
  matchCount: number;
}

export interface StoredSearchStats {
  searchedAt: number;
  url: string;
  totalKeywordsFound: number;
  totalMatches: number;
  keywordCounts: StoredKeywordStat[];
  algorithmStats: Partial<Record<MatchingAlgorithm, StoredAlgorithmStat>>;
}

export interface JudolSettings {
  enabled: boolean;
  blurEnabled: boolean;
  ahoCorasickEnabled: boolean;
  rabinKarpEnabled: boolean;
  ocrEnabled: boolean;
}

export const DEFAULT_SETTINGS: JudolSettings = {
  enabled: true,
  blurEnabled: false,
  ahoCorasickEnabled: false,
  rabinKarpEnabled: false,
  ocrEnabled: false
};

export async function getSettings(): Promise<JudolSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  const settings = stored[SETTINGS_STORAGE_KEY] as Partial<JudolSettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...settings
  };
}

export async function saveSettings(settings: JudolSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
}

export async function getSearchStats(): Promise<Record<string, StoredSearchStats>> {
  const stored = await chrome.storage.local.get(SEARCH_STATS_STORAGE_KEY);
  
  return (stored[SEARCH_STATS_STORAGE_KEY] as Record<string, StoredSearchStats> | undefined) ?? {};
}

export async function saveSearchStats(url: string, stats: StoredSearchStats): Promise<void> {
  const allStats = await getSearchStats();
  
  allStats[url] = stats;
  
  const MAX_STORED_URLS = 20;
  const entries = Object.entries(allStats);
  
  if (entries.length > MAX_STORED_URLS) {
    entries.sort((a, b) => b[1].searchedAt - a[1].searchedAt);
    
    const excessEntries = entries.slice(MAX_STORED_URLS);
    for (const [excessUrl] of excessEntries) {
      delete allStats[excessUrl];
    }
  }

  await chrome.storage.local.set({ [SEARCH_STATS_STORAGE_KEY]: allStats });
}