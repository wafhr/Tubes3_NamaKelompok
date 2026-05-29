import { MatchResult, KeywordStats} from "../algorithms";

let tooltipElement: HTMLDivElement | null = null;

function initTooltip(): HTMLDivElement {
  if (tooltipElement) return tooltipElement;

  tooltipElement = document.createElement("div");
  tooltipElement.id = "ext-judol-tooltip";
  tooltipElement.className = "judol-tooltip";
  tooltipElement.hidden = true;

  document.body.appendChild(tooltipElement);
  return tooltipElement;
}

function generateTooltipContent(matches: MatchResult[], keyStat: KeywordStats): string {
  let htmlContent = "";

  const exactAlgs = matches.filter(m => 
    ["KMP", "Boyer-Moore", "Aho-Corasick", "Rabin-Karp"].includes(m.algorithm)
  );

  if (exactAlgs.length > 0) {
    const sample = exactAlgs[0];
    const keywordLower = sample.keyword.toLowerCase();
    const uniqueAlgs = Array.from(new Set(exactAlgs.map(m => m.algorithm)));
    const algString = uniqueAlgs.join(" dan ");

    const statsMap = keyStat.get(keywordLower);
    let matchCount = 1;
    if (statsMap && statsMap.has(uniqueAlgs[0])) {
      matchCount = statsMap.get(uniqueAlgs[0])!.matchCount;
    }

    htmlContent += `
      <div class="judol-tooltip-section">
        <span class="judol-tooltip-title judol-tooltip-title-exact">Exact Matching</span><br/>
        <strong>Algoritma yang digunakan:</strong> ${algString}<br/>
        <strong>Keyword:</strong> <code class="judol-tooltip-code">${sample.keyword}</code><br/>
        <strong>Jumlah kemunculan:</strong> ${matchCount}<br/>
    `;

    uniqueAlgs.forEach(alg => {
      const algStat = statsMap?.get(alg);
      const timeStr = algStat ? `${algStat.executionTimeMs.toFixed(3)} ms` : "0.00 ms";
      htmlContent += `<strong>Waktu eksekusi ${alg}:</strong> ${timeStr}<br/>`;
    });

    htmlContent += `</div>`;
  }

  const regexMatches = matches.filter(m => m.algorithm === "Regex");
  regexMatches.forEach((m, idx) => {
    const patternLower = m.matchedText.toLowerCase();
    const statsMap = keyStat.get(patternLower);
    const regexStat = statsMap?.get("Regex");
    const matchCount = regexStat ? regexStat.matchCount : 1;
    const timeStr = regexStat ? `${regexStat.executionTimeMs.toFixed(3)} ms` : "0.00 ms";

    if (exactAlgs.length > 0 || idx > 0) {
      htmlContent += `<hr class="judol-tooltip-divider" />`;
    }

    htmlContent += `
      <div class="judol-tooltip-section">
        <span class="judol-tooltip-title judol-tooltip-title-regex">Regex Matching</span><br/>
        <strong>Algoritma yang digunakan:</strong> Regex<br/>
        <strong>Pola/Keyword:</strong> <code class="judol-tooltip-code">${m.matchedText}</code><br/>
        <strong>Jumlah kemunculan:</strong> ${matchCount}<br/>
        <strong>Waktu eksekusi Regex:</strong> ${timeStr}<br/>
      </div>
    `;
  });

  const fuzzyMatches = matches.filter(m => m.algorithm === "Weighted Levenshtein");
  fuzzyMatches.forEach((m, idx) => {
    const keywordLower = m.keyword.toLowerCase();
    const statsMap = keyStat.get(keywordLower);
    const fuzzyStat = statsMap?.get("Weighted Levenshtein");
    const matchCount = fuzzyStat ? fuzzyStat.matchCount : 1;
    const timeStr = fuzzyStat ? `${fuzzyStat.executionTimeMs.toFixed(3)} ms` : "0.00 ms";

    if (exactAlgs.length > 0 || regexMatches.length > 0 || idx > 0) {
      htmlContent += `<hr class="judol-tooltip-divider" />`;
    }

    htmlContent += `
      <div class="judol-tooltip-section">
        <span class="judol-tooltip-title judol-tooltip-title-fuzzy">Fuzzy Matching</span><br/>
        <strong>Algoritma yang digunakan:</strong> Weighted Levenshtein<br/>
        <strong>Keyword Target:</strong> <code class="judol-tooltip-code">${m.keyword}</code><br/>
        <strong>Teks Ditemukan:</strong> <span class="judol-tooltip-found-text">${m.matchedText}</span><br/>
        <strong>Jumlah kemunculan:</strong> ${matchCount}<br/>
        <strong>Waktu eksekusi:</strong> ${timeStr}<br/>
      </div>
    `;
  });

  return htmlContent;
}

export function bindTooltip(element: HTMLElement, matches: MatchResult[], keyStat: KeywordStats): void {
  const tooltip = initTooltip();

  element.addEventListener("mouseenter", (e: MouseEvent) => {
    tooltip.innerHTML = generateTooltipContent(matches, keyStat);
    tooltip.hidden = false;
    updatePosition(e);
  });

  element.addEventListener("mousemove", (e: MouseEvent) => {
    updatePosition(e);
  });

  element.addEventListener("mouseleave", () => {
    tooltip.hidden = true;
  });
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
