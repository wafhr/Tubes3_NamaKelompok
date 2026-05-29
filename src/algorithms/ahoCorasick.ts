import type { KeywordStats, MatchResult } from "./types";
import { measureExecution } from "../utils/timer";

interface AhoCorasickNode {
  transitions: Map<string, number>;
  failureLink: number;
  outputs: string[];
}

export interface AhoCorasickAutomaton {
  nodes: AhoCorasickNode[];
}

export interface AhoCorasickSearchResult {
  matches: MatchResult[];
  comparisons: number;
  automaton: AhoCorasickAutomaton;
}

function createNode(): AhoCorasickNode {
  return {
    transitions: new Map<string, number>(),
    failureLink: 0,
    outputs: []
  };
}

function addKeywordToTrie(nodes: AhoCorasickNode[], keyword: string): void {
  let currentNodeIndex = 0;

  for (let index = 0; index < keyword.length; index += 1) {
    const character = keyword[index];
    const nextNodeIndex = nodes[currentNodeIndex].transitions.get(character);

    if (nextNodeIndex === undefined) {
      const newNodeIndex = nodes.length;
      nodes.push(createNode());
      nodes[currentNodeIndex].transitions.set(character, newNodeIndex);
      currentNodeIndex = newNodeIndex;
    } else {
      currentNodeIndex = nextNodeIndex;
    }
  }

  nodes[currentNodeIndex].outputs.push(keyword);
}

function appendOutputs(target: string[], source: readonly string[]): void {
  for (const output of source) {
    target.push(output);
  }
}

function buildFailureLinks(nodes: AhoCorasickNode[]): void {
  const queue: number[] = [];
  let queueHead = 0;

  for (const childNodeIndex of nodes[0].transitions.values()) {
    nodes[childNodeIndex].failureLink = 0;
    queue.push(childNodeIndex);
  }

  while (queueHead < queue.length) {
    const currentNodeIndex = queue[queueHead];
    queueHead += 1;

    for (const [character, childNodeIndex] of nodes[currentNodeIndex].transitions) {
      let fallbackNodeIndex = nodes[currentNodeIndex].failureLink;

      while (fallbackNodeIndex !== 0 && nodes[fallbackNodeIndex].transitions.get(character) === undefined) {
        fallbackNodeIndex = nodes[fallbackNodeIndex].failureLink;
      }

      const fallbackTransition = nodes[fallbackNodeIndex].transitions.get(character);
      nodes[childNodeIndex].failureLink = fallbackTransition === undefined ? 0 : fallbackTransition;

      appendOutputs(nodes[childNodeIndex].outputs, nodes[nodes[childNodeIndex].failureLink].outputs);
      queue.push(childNodeIndex);
    }
  }
}

export function buildAhoCorasickAutomaton(keywords: readonly string[]): AhoCorasickAutomaton {
  const nodes: AhoCorasickNode[] = [createNode()];

  for (const keyword of keywords) {
    if (keyword.length > 0) {
      addKeywordToTrie(nodes, keyword);
    }
  }

  buildFailureLinks(nodes);

  return { nodes };
}

function runAhoCorasickSearch(text: string, keywords: readonly string[]): AhoCorasickSearchResult {
  const automaton = buildAhoCorasickAutomaton(keywords);
  const matches: MatchResult[] = [];
  let currentNodeIndex = 0;
  let comparisons = 0;

  for (let textIndex = 0; textIndex < text.length; textIndex += 1) {
    const character = text[textIndex];
    comparisons += 1;

    while (currentNodeIndex !== 0 && automaton.nodes[currentNodeIndex].transitions.get(character) === undefined) {
      currentNodeIndex = automaton.nodes[currentNodeIndex].failureLink;
      comparisons += 1;
    }

    const nextNodeIndex = automaton.nodes[currentNodeIndex].transitions.get(character);
    currentNodeIndex = nextNodeIndex === undefined ? 0 : nextNodeIndex;

    for (const keyword of automaton.nodes[currentNodeIndex].outputs) {
      const endIndex = textIndex + 1;
      const startIndex = endIndex - keyword.length;

      matches.push({
        keyword,
        algorithm: "Aho-Corasick",
        startIndex,
        endIndex,
        matchedText: text.slice(startIndex, endIndex),
        comparisons
      });
    }
  }

  return {
    matches,
    comparisons,
    automaton
  };
}

export function searchAhoCorasickKeywords(text: string, keywords: readonly string[], keyStat: KeywordStats): AhoCorasickSearchResult {
  const automaton = buildAhoCorasickAutomaton(keywords);
  const matches: MatchResult[] = [];
  let comparisons = 0;

  for (const keyword of keywords) {
    const { result, executionTimeMs: execTime } = measureExecution(() => runAhoCorasickSearch(text, [keyword]));

    // tambah keyStat
    if (result.matches.length > 0) {
      const algoKey = "Aho-Corasick";

      if (!keyStat.has(keyword)) keyStat.set(keyword, new Map());

      const algoMap = keyStat.get(keyword)!;
      const prevCount = algoMap.get(algoKey)?.matchCount ?? 0;
      const prevTime = algoMap.get(algoKey)?.executionTimeMs ?? 0;

      algoMap.set(algoKey, {
        matchCount: prevCount + result.matches.length,
        executionTimeMs: prevTime + execTime
      });
    }

    comparisons += result.comparisons;

    for (const match of result.matches) {
      matches.push(match);
    }
  }

  return {
    matches,
    comparisons,
    automaton
  };
}
