import { MatchResult } from "../algorithms";

let tooltipElement: HTMLDivElement | null = null;

interface TooltipListeners {
  mouseenter: (e: MouseEvent) => void;
  mousemove: (e: MouseEvent) => void;
  mouseleave: () => void;
}

const elementListenersMap = new WeakMap<HTMLElement, TooltipListeners>();

const IMMUNE_TAGS = new Set(["BODY", "HTML", "MAIN", "ARTICLE", "SECTION"]);
const INLINE_TAGS = new Set(["EM", "STRONG", "B", "I", "A", "CODE", "SMALL", "MARK"]);

function initTooltip(): HTMLDivElement {
  if (tooltipElement) return tooltipElement;

  tooltipElement = document.createElement("div");
  tooltipElement.id = "ext-judol-tooltip";
  tooltipElement.className = "judol-tooltip";
  tooltipElement.hidden = true;

  document.body.appendChild(tooltipElement);

  return tooltipElement;
}

export function findTooltipTarget(node: Node): HTMLElement | null {
  let parent = node.parentNode as HTMLElement | null;
  let lastValidInline: HTMLElement | null = null;

  while (parent) {
    if (parent.nodeType === Node.ELEMENT_NODE) {
      const tagName = parent.tagName;

      if (IMMUNE_TAGS.has(tagName)) {
        return lastValidInline;
      }

      if (INLINE_TAGS.has(tagName)) {
        lastValidInline = parent;
        parent = parent.parentNode as HTMLElement | null;
        continue;
      }

      return parent;
    }

    parent = parent.parentNode as HTMLElement | null;
  }

  return null;
}

function generateTooltipContent(matches: MatchResult[]): string {
  if (matches.length === 0) return "";


  const keywordCounts = new Map<string, number>();
  for (const m of matches) {
    keywordCounts.set(m.keyword, (keywordCounts.get(m.keyword) ?? 0) + 1);
  }

  const uniqueKeywords = Array.from(keywordCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const uniqueAlgorithms = Array.from(new Set(matches.map((m) => m.algorithm).filter(Boolean)));

  const algorithmTimeMap = new Map<string, number>();
  for (const m of matches) {
    if (m.algorithm && m.searchTime) {
      const current = algorithmTimeMap.get(m.algorithm) || 0;
      if (m.searchTime > current) {
        algorithmTimeMap.set(m.algorithm, m.searchTime);
      }
    }
  }
  const totalExecutionTimeMs = Array.from(algorithmTimeMap.values())
    .reduce((sum, t) => sum + t, 0);

  const totalMatches = matches.length;

  const keywordBadges = uniqueKeywords
    .map(([kw, count]) => `<code class="judol-tooltip-code">${kw}</code> <small>(${count}x)</small>`)
    .join(", ");

  const characterImgUrl = chrome.runtime.getURL("images/megumi.png");

  return `
    <img src="${characterImgUrl}" class="judol-tooltip-character" alt="Mascot" />

    <div class="judol-tooltip-section">
      <span class="judol-tooltip-title">
        Terdeteksi Konten Judol
      </span>
      <br/><br/>

      <strong>Algoritma:</strong> ${uniqueAlgorithms.join(" & ")}<br/>
      <strong>Keywords:</strong> ${keywordBadges}<br/>

      <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:10px 0;" />

      <strong>Total Kemunculan:</strong> ${totalMatches} match<br/>
      <strong>Waktu Eksekusi:</strong> ${totalExecutionTimeMs.toFixed(3)} ms<br/>
    </div>
  `;
}

export function bindTooltip(
  element: HTMLElement,
  matches: MatchResult[]
): void {
  const tooltip = initTooltip();

  if (elementListenersMap.has(element)) {
    clearTooltip(element);
  }

  const mouseEnterHandler = (e: MouseEvent) => {
    tooltip.innerHTML = generateTooltipContent(matches);
    tooltip.hidden = false;
    updatePosition(e);
  };

  const mouseMoveHandler = (e: MouseEvent) => {
    updatePosition(e);
  };

  const mouseLeaveHandler = () => {
    tooltip.hidden = true;
  };

  element.addEventListener("mouseenter", mouseEnterHandler);
  element.addEventListener("mousemove", mouseMoveHandler);
  element.addEventListener("mouseleave", mouseLeaveHandler);

  elementListenersMap.set(element, {
    mouseenter: mouseEnterHandler,
    mousemove: mouseMoveHandler,
    mouseleave: mouseLeaveHandler
  });
}

export function clearTooltip(element: HTMLElement): void {
  const listeners = elementListenersMap.get(element);
  if (!listeners) return;

  element.removeEventListener("mouseenter", listeners.mouseenter);
  element.removeEventListener("mousemove", listeners.mousemove);
  element.removeEventListener("mouseleave", listeners.mouseleave);

  elementListenersMap.delete(element);

  if (tooltipElement) {
    tooltipElement.hidden = true;
  }
}

function updatePosition(e: MouseEvent): void {
  if (!tooltipElement) return;

  const offsetForCursor = 15;
  let posX = e.pageX + offsetForCursor;
  let posY = e.pageY + offsetForCursor;

  const tooltipWidth = tooltipElement.offsetWidth;

  if (posX + tooltipWidth > window.innerWidth + window.scrollX) {
    posX = e.pageX - tooltipWidth - offsetForCursor;
  }

  tooltipElement.style.left = `${posX}px`;
  tooltipElement.style.top = `${posY}px`;
}