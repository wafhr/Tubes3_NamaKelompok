import type { MatchingAlgorithm } from "../algorithms";
import {
  getSearchStats,
  getSettings,
  saveSettings,
  SEARCH_STATS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from "../utils/storage";
import type { JudolSettings, StoredSearchStats } from "../utils/storage";
import { MANUAL_RESCAN_MESSAGE_TYPE } from "../utils/constants";

const MAX_VISIBLE_KEYWORDS = 10;
const ALGORITHM_ORDER: MatchingAlgorithm[] = [
  "KMP",
  "Boyer-Moore",
  "Regex",
  "Aho-Corasick",
  "Rabin-Karp",
  "Weighted Levenshtein",
  "OCR"
];

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing popup element: ${id}`);
  }

  return element as T;
}

function formatTime(executionTimeMs: number): string {
  return `${executionTimeMs.toFixed(3)} ms`;
}

function formatSearchMeta(stats: StoredSearchStats | null): string {
  if (!stats) {
    return "Belum ada search";
  }

  const searchedAt = new Date(stats.searchedAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  return `Search terakhir ${searchedAt}`;
}

function renderKeywordChart(stats: StoredSearchStats | null): void {
  const chart = getElement<HTMLDivElement>("keyword-chart");
  chart.replaceChildren();

  if (!stats || stats.keywordCounts.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "judol-empty-state";
    emptyState.textContent = "Belum ada keyword terdeteksi.";
    chart.appendChild(emptyState);
    return;
  }

  const visibleKeywords = stats.keywordCounts.slice(0, MAX_VISIBLE_KEYWORDS);
  const remainingKeywords = stats.keywordCounts.slice(MAX_VISIBLE_KEYWORDS);
  const remainingCount = remainingKeywords.reduce((total, item) => total + item.matchCount, 0);
  const chartItems = remainingCount > 0
    ? [...visibleKeywords, { keyword: "Lainnya", matchCount: remainingCount }]
    : visibleKeywords;
  const maxCount = Math.max(...chartItems.map((item) => item.matchCount), 1);

  for (const item of chartItems) {
    const row = document.createElement("div");
    row.className = "judol-bar-row";

    const label = document.createElement("span");
    label.className = "judol-bar-label";
    label.textContent = item.keyword;
    label.title = item.keyword;

    const track = document.createElement("div");
    track.className = "judol-bar-track";

    const fill = document.createElement("div");
    fill.className = "judol-bar-fill";
    fill.style.width = `${Math.max(6, (item.matchCount / maxCount) * 100)}%`;
    track.appendChild(fill);

    const value = document.createElement("strong");
    value.className = "judol-bar-value";
    value.textContent = String(item.matchCount);

    row.append(label, track, value);
    chart.appendChild(row);
  }
}

function renderAlgorithmTable(stats: StoredSearchStats | null): void {
  const tableBody = getElement<HTMLTableSectionElement>("algorithm-table");
  tableBody.replaceChildren();

  if (!stats || Object.keys(stats.algorithmStats).length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "judol-empty-state";
    cell.textContent = "Belum ada data algoritma.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  for (const algorithm of ALGORITHM_ORDER) {
    const algorithmStat = stats.algorithmStats[algorithm];

    if (!algorithmStat) {
      continue;
    }

    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const matchCell = document.createElement("td");
    const timeCell = document.createElement("td");
    const compareCell = document.createElement("td");

    nameCell.textContent = algorithm;
    matchCell.textContent = String(algorithmStat.matchCount);
    timeCell.textContent = formatTime(algorithmStat.executionTimeMs);
    compareCell.textContent = String(algorithmStat.comparisons);

    row.append(nameCell, matchCell, timeCell, compareCell);
    tableBody.appendChild(row);
  }
}

function renderStats(stats: StoredSearchStats | null): void {
  getElement("search-meta").textContent = formatSearchMeta(stats);
  getElement("total-keywords").textContent = String(stats?.totalKeywordsFound ?? 0);
  getElement("total-matches").textContent = String(stats?.totalMatches ?? 0);

  renderKeywordChart(stats);
  renderAlgorithmTable(stats);
}

function renderSettings(settings: JudolSettings): void {
  getElement<HTMLInputElement>("enabled-toggle").checked = settings.enabled;
  getElement<HTMLSpanElement>("enabled-toggle-label").textContent = settings.enabled ? "On" : "Off";
  getElement<HTMLInputElement>("blur-toggle").checked = settings.blurEnabled;
  getElement<HTMLInputElement>("aho-toggle").checked = settings.ahoCorasickEnabled;
  getElement<HTMLInputElement>("rabin-toggle").checked = settings.rabinKarpEnabled;
  getElement<HTMLInputElement>("ocr-toggle").checked = settings.ocrEnabled;
  getElement<HTMLButtonElement>("rescan-button").disabled = !settings.enabled;
}

async function updateSettings(patch: Partial<JudolSettings>): Promise<void> {
  const settings = await getSettings();
  await saveSettings({
    ...settings,
    ...patch
  });
}

function bindSettingsControls(): void {
  getElement<HTMLInputElement>("enabled-toggle").addEventListener("change", (event) => {
    const enabled = (event.currentTarget as HTMLInputElement).checked;

    getElement<HTMLSpanElement>("enabled-toggle-label").textContent = enabled ? "On" : "Off";
    void updateSettings({ enabled });
  });

  getElement<HTMLInputElement>("blur-toggle").addEventListener("change", (event) => {
    void updateSettings({ blurEnabled: (event.currentTarget as HTMLInputElement).checked });
  });

  getElement<HTMLInputElement>("aho-toggle").addEventListener("change", (event) => {
    void updateSettings({ ahoCorasickEnabled: (event.currentTarget as HTMLInputElement).checked });
  });

  getElement<HTMLInputElement>("rabin-toggle").addEventListener("change", (event) => {
    void updateSettings({ rabinKarpEnabled: (event.currentTarget as HTMLInputElement).checked });
  });

  getElement<HTMLInputElement>("ocr-toggle").addEventListener("change", (event) => {
    void updateSettings({ ocrEnabled: (event.currentTarget as HTMLInputElement).checked });
  });
}

async function requestManualRescan(): Promise<void> {
  const settings = await getSettings();

  if (!settings.enabled) {
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (activeTab?.id === undefined) {
    return;
  }

  const response = await chrome.tabs.sendMessage(activeTab.id, { type: MANUAL_RESCAN_MESSAGE_TYPE });

  if ((response as { ok?: boolean } | undefined)?.ok === false) {
    throw new Error("Content script rejected manual rescan");
  }
}

function bindRescanControl(): void {
  const rescanButton = getElement<HTMLButtonElement>("rescan-button");

  rescanButton.addEventListener("click", () => {
    rescanButton.disabled = true;

    void requestManualRescan()
      .then(async () => {
        const settings = await getSettings();
        rescanButton.disabled = !settings.enabled;
      })
      .catch((error: unknown) => {
        console.error("[Judol Detector] manual rescan failed", error);
        rescanButton.disabled = false;
      });
  });
}

async function initializePopup(): Promise<void> {
  const [settings, allStats, tabs] = await Promise.all([
    getSettings(), getSearchStats(), chrome.tabs.query({ active: true, currentWindow: true })]);

  const activeTab = tabs[0];
  const activeUrl = activeTab?.url ?? "";
  const stats = allStats[activeUrl] ?? null;

  renderSettings(settings);
  renderStats(stats);
  bindSettingsControls();
  bindRescanControl();

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[SETTINGS_STORAGE_KEY]?.newValue) {
      renderSettings(changes[SETTINGS_STORAGE_KEY].newValue as JudolSettings);
    }

    // Hanya update UI jika data URL aktif saat ini ikut berubah di storage
    if (changes[SEARCH_STATS_STORAGE_KEY]) {
      const [currentActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentActiveUrl = currentActiveTab?.url ?? "";
      
      const newAllStats = changes[SEARCH_STATS_STORAGE_KEY].newValue as Record<string, StoredSearchStats> | undefined;
      
      // Ambil data terbaru khusus untuk tab yang sedang dipandang user
      renderStats(newAllStats?.[currentActiveUrl] ?? null);
    }
  });
}

void initializePopup();
