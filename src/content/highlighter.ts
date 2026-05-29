import { DomMatchResult, KeywordStats, MatchResult } from "../algorithms";
import { applyContainerCensor, clearContainerCensorship } from "./censor";
import { bindTooltip } from "./tooltip";

const HIGHLIGHT_CLASS = "judol-highlight";

export function clearHighlights(): void {
  clearContainerCensorship();

  const highlightedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  
  highlightedElements.forEach(element => {
    const parent = element.parentNode;
    if (parent) {
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
    }
  });
  document.body.normalize();
}

export function highlightMatches(matches: DomMatchResult[], keyStat: KeywordStats, blurEnabled = false): number {
  if (matches.length === 0) return 0;

  applyContainerCensor(matches, blurEnabled);
  
  const nodeMatchesMap = new Map<Text, DomMatchResult[]>();
  for (const match of matches) {
    if (!nodeMatchesMap.has(match.node)) {
      nodeMatchesMap.set(match.node, []);
    }
    nodeMatchesMap.get(match.node)!.push(match);
  }

  let totalHighlightedSpans = 0;

  for (const [textNode, nodeMatches] of nodeMatchesMap.entries()) {
    const parent = textNode.parentNode;
    if (!parent) continue;

    const fullText = typeof textNode.data === "string" ? textNode.data : "";
    if (fullText.length === 0) continue;

    const boundaries = new Set<number>();
    boundaries.add(0);
    boundaries.add(fullText.length);

    for (const m of nodeMatches) {
      boundaries.add(m.match.startIndex);
      boundaries.add(m.match.endIndex);
    }

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const documentFragment = document.createDocumentFragment();

    // SLICING
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i];
      const end = sortedBoundaries[i + 1];
      const sliceText = fullText.substring(start, end);

      const overlappingMatches = nodeMatches.filter(
        m => m.match.startIndex <= start && m.match.endIndex >= end
      );

      if (overlappingMatches.length === 0) {
        documentFragment.appendChild(document.createTextNode(sliceText));
      } else {
        const markElement = document.createElement("mark");
        markElement.className = HIGHLIGHT_CLASS;
        markElement.dataset.judolHighlight = "true";
        markElement.textContent = sliceText;

        const matchResults: MatchResult[] = overlappingMatches.map(m => m.match);
        bindTooltip(markElement, matchResults, keyStat);

        documentFragment.appendChild(markElement);
        totalHighlightedSpans++;
      }
    }
    parent.replaceChild(documentFragment, textNode);
  }
  return totalHighlightedSpans;
}
