import { DomMatchResult } from "../algorithms";

const CENSOR_CONTAINER_CLASS = "judol-container-blur";
const CENSOR_DATA_ATTR = "data-judol-censored";

const IMMUNE_TAGS = new Set(["BODY", "HTML", "MAIN", "ARTICLE", "SECTION"]);
const INLINE_TAGS = new Set(["EM", "STRONG", "B", "I", "A", "CODE", "SMALL"]);

function findCensorTarget(node: Node): HTMLElement | null {
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
      
      // Berhasil menemukan Block Element (seperti SPAN terluar, P, DIV, LI, TD)
      return parent;
    }
    parent = parent.parentNode as HTMLElement | null;
  }
  
  return null;
}

export function applyContainerCensor(matches: DomMatchResult[], enabled: boolean): void {
  if (!enabled || matches.length === 0) return;

  for (const match of matches) {
    if (!match.node) continue;
    
    const targetElement = findCensorTarget(match.node);
    if (targetElement) {
      targetElement.classList.add(CENSOR_CONTAINER_CLASS);
      targetElement.setAttribute(CENSOR_DATA_ATTR, "true");
    }
  }
}

export function setContainerCensorBlur(enabled: boolean): void {
  const censoredElements = document.querySelectorAll(`[${CENSOR_DATA_ATTR}="true"]`);
  
  censoredElements.forEach(element => {
    if (enabled) {
      element.classList.add(CENSOR_CONTAINER_CLASS);
    } else {
      element.classList.remove(CENSOR_CONTAINER_CLASS);
    }
  });
}

export function clearContainerCensorship(): void {
  const censoredElements = document.querySelectorAll(`[${CENSOR_DATA_ATTR}="true"]`);
  
  censoredElements.forEach(element => {
    element.classList.remove(CENSOR_CONTAINER_CLASS);
    element.removeAttribute(CENSOR_DATA_ATTR);
  });
}