import { SKIPPED_TEXT_PARENT_TAGS } from "../utils/constants";
import { isBlankText } from "../utils/textNormalizer";

export interface TextNodeInfo {
  node: Text;
  text: string;
}

const EXTENSION_TEXT_SELECTOR = [
  "#ext-judol-tooltip",
  ".judol-tooltip",
  ".judol-text-node-wrapper",
  ".judol-highlight",
  "[data-judol-ocr-censored]",
  "[data-judol-censored]"
].join(",");

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;

  if (!parent) {
    return true;
  }

  return SKIPPED_TEXT_PARENT_TAGS.has(parent.tagName) || parent.closest(EXTENSION_TEXT_SELECTOR) !== null;
}

export function collectTextNodes(root: ParentNode = document.body): TextNodeInfo[] {
  const textNodes: TextNodeInfo[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const text = textNode.nodeValue ?? "";

    if (!shouldSkipTextNode(textNode) && !isBlankText(text)) {
      textNodes.push({ node: textNode, text });
    }

    currentNode = walker.nextNode();
  }

  return textNodes;
}
