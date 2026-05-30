import { DomMatchResult, MatchResult } from "../algorithms";
import { applyContainerCensor, clearContainerCensorship } from "./censor";

const HIGHLIGHT_CLASS = "judol-highlight";
const WRAPPER_CLASS = "judol-text-node-wrapper";

export function clearHighlights(): void {
  clearContainerCensorship();

  // 1. Lepaskan wrapper span terlebih dahulu
  const wrappers = document.querySelectorAll(`.${WRAPPER_CLASS}`);
  wrappers.forEach(wrapper => {
    const parent = wrapper.parentNode;
    if (parent) {
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      parent.removeChild(wrapper);
    }
  });

  // 2. Bersihkan sisa elemen highlight mark jika ada
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

export function highlightMatches(
  matches: DomMatchResult[], 
  blurEnabled = false
): Map<HTMLElement, MatchResult[]> {
  const wrapperToMatchesMap = new Map<HTMLElement, MatchResult[]>();
  if (matches.length === 0) return wrapperToMatchesMap;

  applyContainerCensor(matches, blurEnabled);
  
  // Kelompokkan matches berdasarkan TextNode asalnya
  const nodeMatchesMap = new Map<Text, DomMatchResult[]>();
  for (const match of matches) {
    if (!match.node) continue;
    if (!nodeMatchesMap.has(match.node)) {
      nodeMatchesMap.set(match.node, []);
    }
    nodeMatchesMap.get(match.node)!.push(match);
  }

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
    
    // Buat wrapper penampung textNode mula-mula
    const wrapperSpan = document.createElement("span");
    wrapperSpan.className = WRAPPER_CLASS;
    wrapperSpan.style.display = "inline"; 

    // Proses Slicing ke dalam wrapper
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i];
      const end = sortedBoundaries[i + 1];
      const sliceText = fullText.substring(start, end);

      const overlappingMatches = nodeMatches.filter(
        m => m.match.startIndex <= start && m.match.endIndex >= end
      );

      if (overlappingMatches.length === 0) {
        wrapperSpan.appendChild(document.createTextNode(sliceText));
      } else {
        const markElement = document.createElement("mark");
        markElement.className = HIGHLIGHT_CLASS;
        markElement.dataset.judolHighlight = "true";
        markElement.textContent = sliceText;

        wrapperSpan.appendChild(markElement);
      }
    }
    
    parent.replaceChild(wrapperSpan, textNode);
    
    // Daftarkan wrapper ke Map untuk di-bind oleh content.ts nanti
    const pureMatches = nodeMatches.map(m => m.match);
    wrapperToMatchesMap.set(wrapperSpan, pureMatches);
  }
  
  return wrapperToMatchesMap;
}